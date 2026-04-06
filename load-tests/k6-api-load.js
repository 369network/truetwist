/**
 * k6 Load Test — TrueTwist API endpoints.
 *
 * Run: k6 run load-tests/k6-api-load.js
 * With env: k6 run -e BASE_URL=https://staging.truetwist.com load-tests/k6-api-load.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Custom metrics
const errorRate = new Rate('errors');
const healthLatency = new Trend('health_latency', true);
const authLatency = new Trend('auth_latency', true);

export const options = {
  scenarios: {
    // Smoke test: 1 user for 30s
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    // Load test: ramp up to 50 concurrent users
    load: {
      executor: 'ramping-vus',
      startTime: '30s',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      tags: { scenario: 'load' },
    },
    // Spike test: sudden burst
    spike: {
      executor: 'ramping-vus',
      startTime: '6m',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '30s', target: 100 },
        { duration: '10s', target: 0 },
      ],
      tags: { scenario: 'spike' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    errors: ['rate<0.1'],
    health_latency: ['p(95)<500'],
    auth_latency: ['p(95)<1000'],
  },
};

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  healthLatency.add(healthRes.timings.duration);
  check(healthRes, {
    'health status 200 or 503': (r) => [200, 503].includes(r.status),
    'health has status field': (r) => JSON.parse(r.body).status !== undefined,
  });
  errorRate.add(healthRes.status >= 500 && healthRes.status !== 503);

  // Auth: login attempt (expected to fail with 401/422 but should not 500)
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: 'loadtest@example.com', password: 'LoadTest123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  authLatency.add(loginRes.timings.duration);
  check(loginRes, {
    'auth does not 500': (r) => r.status < 500,
    'auth response is JSON': (r) => {
      try { JSON.parse(r.body); return true; } catch { return false; }
    },
  });
  errorRate.add(loginRes.status >= 500);

  // Public endpoints (should not require auth)
  const publicRes = http.get(`${BASE_URL}/api/v1/health`);
  check(publicRes, {
    'public endpoint responds': (r) => r.status < 500,
  });
  errorRate.add(publicRes.status >= 500);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-tests/results/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  // k6 built-in text summary fallback
  const lines = [];
  lines.push('=== Load Test Summary ===');
  if (data.metrics) {
    for (const [name, metric] of Object.entries(data.metrics)) {
      if (metric.values) {
        const vals = Object.entries(metric.values)
          .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`)
          .join(', ');
        lines.push(`  ${name}: ${vals}`);
      }
    }
  }
  return lines.join('\n');
}
