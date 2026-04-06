import { test, expect } from '@playwright/test';

test.describe('API Health Check', () => {
  test('GET /api/v1/health returns status', async ({ request }) => {
    const res = await request.get('/api/v1/health');
    expect([200, 503]).toContain(res.status());

    const body = await res.json();
    expect(body.status).toBeTruthy();
    expect(body.version).toBeTruthy();
    expect(body.dependencies).toBeTruthy();
    expect(body.dependencies.database).toBeTruthy();
    expect(body.dependencies.redis).toBeTruthy();
  });

  test('GET /api/v1/openapi returns OpenAPI spec', async ({ request }) => {
    const res = await request.get('/api/v1/openapi');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.openapi || body.info).toBeTruthy();
  });
});
