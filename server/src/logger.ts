import { LogEvent, RequestContextData, DownstreamCall } from './types.js';

export class RequestContext {
  private data: RequestContextData;

  constructor(request: Request, route: string) {
    this.data = {
      request_id: crypto.randomUUID(),
      trace_id: crypto.randomUUID(),
      route,
      method: request.method,
      startTime: performance.now(),
      error_type: null,
    };
  }

  setStatus(status: number): void {
    this.data.status = status;
  }

  setErrorType(errorType: string): void {
    this.data.error_type = errorType;
  }

  addDownstreamCall(call: DownstreamCall): void {
    if (!this.data.downstream_calls) {
      this.data.downstream_calls = [];
    }
    this.data.downstream_calls.push(call);
  }

  setPayloadSize(size: number): void {
    this.data.payload_size = size;
  }

  private getLatencyMs(): number {
    return Math.round(performance.now() - this.data.startTime);
  }

  private getLatencyBucket(latencyMs: number): 'fast' | 'medium' | 'slow' {
    if (latencyMs < 50) return 'fast';
    if (latencyMs < 200) return 'medium';
    return 'slow';
  }

  private getLevel(status: number): 'info' | 'warn' | 'error' {
    if (status >= 500) return 'error';
    if (status >= 400) return 'error';
    return 'info';
  }

  toLogEvent(): LogEvent {
    const latency_ms = this.getLatencyMs();
    const status = this.data.status ?? 500;
    
    return {
      timestamp: new Date().toISOString(),
      level: this.getLevel(status),
      event: 'request.end',
      request_id: this.data.request_id,
      trace_id: this.data.trace_id,
      route: this.data.route,
      method: this.data.method,
      status,
      latency_ms,
      latency_bucket: this.getLatencyBucket(latency_ms),
      error_type: this.data.error_type ?? null,
      downstream_calls: this.data.downstream_calls,
      payload_size: this.data.payload_size,
    };
  }
}

export function log(ctx: RequestContext): void {
  console.log(JSON.stringify(ctx.toLogEvent()));
}
