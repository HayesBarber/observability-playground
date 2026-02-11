import { RequestContext, log } from './logger.js';
import { DownstreamCall } from './types.js';

// Latency simulation helpers
async function sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPercent(): number {
    return Math.random() * 100;
}

// Latency buckets for /items/:id
async function simulateItemLatency(): Promise<number> {
    const rand = Math.random();
    let latency: number;

    if (rand < 0.80) {
        // 80% fast: 5-20ms
        latency = randomBetween(5, 20);
    } else if (rand < 0.95) {
        // 15% medium: 50-150ms
        latency = randomBetween(50, 150);
    } else {
        // 5% slow: 300-800ms
        latency = randomBetween(300, 800);
    }

    await sleep(latency);
    return latency;
}

// Error simulation for /items/:id
function simulateItemError(): string | null {
    if (randomPercent() < 1.5) {
        const errors = ['not_found', 'timeout', 'downstream_error'];
        return errors[Math.floor(Math.random() * errors.length)];
    }
    return null;
}

// Simulate downstream call for fanout
async function simulateDownstreamCall(): Promise<DownstreamCall> {
    const latency = randomBetween(10, 200);
    await sleep(latency);

    const success = randomPercent() > 20; // 20% failure rate per call

    return {
        call_id: crypto.randomUUID(),
        latency_ms: latency,
        success,
        ...(success ? {} : { error_type: 'downstream_error' }),
    };
}

// Middleware wrapper
function withLogging(
    route: string,
    handler: (req: Request, ctx: RequestContext) => Promise<Response> | Response
): (req: Request) => Promise<Response> {
    return async (req: Request): Promise<Response> => {
        const ctx = new RequestContext(req, route);

        try {
            const res = await handler(req, ctx);
            ctx.setStatus(res.status);
            log(ctx);
            return res;
        } catch (err) {
            ctx.setStatus(500);
            ctx.setErrorType('internal_error');
            log(ctx);
            throw err;
        }
    };
}

// Route handlers
const healthHandler = withLogging('/health', async (_req, _ctx): Promise<Response> => {
    await sleep(randomBetween(1, 5));
    return new Response('OK', { status: 200 });
});

const itemsGetHandler = withLogging('/items/:id', async (_req, ctx): Promise<Response> => {
    const latency = await simulateItemLatency();
    const errorType = simulateItemError();

    if (errorType) {
        ctx.setErrorType(errorType);

        if (errorType === 'not_found') {
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        } else if (errorType === 'timeout') {
            return new Response(JSON.stringify({ error: 'Request timeout' }), {
                status: 504,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({ error: 'Downstream service error' }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response(JSON.stringify({ id: crypto.randomUUID(), latency_ms: latency }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
});

const itemsPostHandler = withLogging('/items', async (req, ctx): Promise<Response> => {
    // Higher baseline latency for writes
    const baseLatency = randomBetween(20, 50);
    await sleep(baseLatency);

    // Parse body to get payload size
    let payloadSize = 0;
    let body: unknown;
    try {
        body = await req.json();
        payloadSize = JSON.stringify(body).length;
        ctx.setPayloadSize(payloadSize);
    } catch {
        ctx.setErrorType('validation_error');
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Validation failures (10%)
    if (randomPercent() < 10) {
        ctx.setErrorType('validation_error');
        return new Response(JSON.stringify({ error: 'Validation failed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Simulated DB latency
    const dbLatency = randomBetween(30, 100);
    await sleep(dbLatency);

    // Rare DB failure (2%)
    if (randomPercent() < 2) {
        ctx.setErrorType('database_error');
        return new Response(JSON.stringify({ error: 'Database error' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
        id: crypto.randomUUID(),
        created: true,
        total_latency_ms: baseLatency + dbLatency
    }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    });
});

const fanoutHandler = withLogging('/fanout', async (_req, ctx): Promise<Response> => {
    // 2-5 downstream calls
    const numCalls = randomBetween(2, 5);
    const calls: Promise<DownstreamCall>[] = [];

    for (let i = 0; i < numCalls; i++) {
        calls.push(simulateDownstreamCall());
    }

    const results = await Promise.all(calls);

    // Add all downstream calls to context
    results.forEach(call => ctx.addDownstreamCall(call));

    // Request succeeds even with partial failures (per spec)
    const failedCalls = results.filter(r => !r.success);
    if (failedCalls.length > 0) {
        ctx.setErrorType('partial_downstream_failure');
    }

    return new Response(JSON.stringify({
        downstream_calls: numCalls,
        successful: results.filter(r => r.success).length,
        failed: failedCalls.length
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
});

// Router
function router(req: Request): Promise<Response> | Response {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Health check
    if (path === '/health' && method === 'GET') {
        return healthHandler(req);
    }

    // GET /items/:id
    if (path.startsWith('/items/') && method === 'GET') {
        return itemsGetHandler(req);
    }

    // POST /items
    if (path === '/items' && method === 'POST') {
        return itemsPostHandler(req);
    }

    // GET /fanout
    if (path === '/fanout' && method === 'GET') {
        return fanoutHandler(req);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
    });
}

// Start server
const PORT = 3000;

Bun.serve({
    port: PORT,
    fetch: router,
});

