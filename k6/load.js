import http from 'k6/http';
import { check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const MAX_TPS = parseInt(__ENV.K6_MAX_TPS || '100');

export const options = {
    scenarios: {
        load_test: {
            executor: 'ramping-arrival-rate',
            startRate: 0,
            timeUnit: '1s',
            preAllocatedVUs: 50,
            maxVUs: 200,
            stages: [
                { target: Math.floor(MAX_TPS * 0.5), duration: '2m' },
                { target: Math.floor(MAX_TPS * 0.5), duration: '2m' },
                { target: MAX_TPS, duration: '1m' },
                { target: MAX_TPS, duration: '2m' },
                { target: Math.floor(MAX_TPS * 0.3), duration: '1m' },
                { target: Math.floor(MAX_TPS * 0.75), duration: '2m' },
            ],
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],
    },
};

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomItem() {
    const fields = randomBetween(3, 8);
    const item = {};

    for (let i = 0; i < fields; i++) {
        const key = `field_${i}`;
        const type = Math.random();

        if (type < 0.4) {
            item[key] = `value_${randomBetween(1, 1000)}_${uuidv4().slice(0, 8)}`;
        } else if (type < 0.7) {
            item[key] = randomBetween(1, 1000000);
        } else if (type < 0.9) {
            item[key] = Math.random() > 0.5;
        } else {
            item[key] = { nested: `data_${randomBetween(1, 100)}` };
        }
    }

    return item;
}

export default function() {
    const rand = Math.random();

    if (rand < 0.60) {
        const res = http.get(`${BASE_URL}/health`);
        check(res, { 'health succeeded': (r) => r.status < 400 });
    } else if (rand < 0.85) {
        const id = uuidv4();
        const res = http.get(`${BASE_URL}/items/${id}`);
        check(res, { 'items-get succeeded': (r) => r.status < 400 });
    } else if (rand < 0.95) {
        const res = http.get(`${BASE_URL}/fanout`);
        check(res, { 'fanout succeeded': (r) => r.status < 400 });
    } else {
        const payload = generateRandomItem();
        const res = http.post(`${BASE_URL}/items`, JSON.stringify(payload), {
            headers: { 'Content-Type': 'application/json' },
        });
        check(res, { 'items-post succeeded': (r) => r.status < 400 });
    }
}
