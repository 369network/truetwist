/**
 * Tests for /api/v1/developer/api-keys — API key management.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TEST_USER,
  buildAuthRequest,
  createPrismaMock,
  parseResponse,
} from './helpers';
import { generateAccessToken } from '@/lib/auth';
import type { PlanTier } from '@/types';

const prismaMock = createPrismaMock();
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/audit', () => ({
  auditFromRequest: vi.fn(),
  auditLog: vi.fn(),
  AuditActions: {},
}));

const { GET, POST } = await import('@/app/api/v1/developer/api-keys/route');

const token = generateAccessToken(TEST_USER.id, TEST_USER.email, TEST_USER.plan as PlanTier);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/developer/api-keys', () => {
  it('should return 401 without auth', async () => {
    const req = new (await import('next/server')).NextRequest(
      new URL('http://localhost:3000/api/v1/developer/api-keys'),
      { method: 'GET' }
    );
    const res = await GET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it('should list API keys for authenticated user', async () => {
    const mockKeys = [
      {
        id: 'key-1',
        name: 'Production Key',
        keyPrefix: 'tt_abcdef12',
        scope: 'read',
        status: 'active',
        expiresAt: null,
        lastUsedAt: null,
        requestCount: 42,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    prismaMock.apiKey.findMany.mockResolvedValue(mockKeys);

    const req = buildAuthRequest('GET', '/api/v1/developer/api-keys', token);
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Production Key');
    expect(body.data[0].requestCount).toBe(42);
  });
});

describe('POST /api/v1/developer/api-keys', () => {
  it('should return 401 without auth', async () => {
    const req = new (await import('next/server')).NextRequest(
      new URL('http://localhost:3000/api/v1/developer/api-keys'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      }
    );
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it('should return 422 for missing name', async () => {
    const req = buildAuthRequest('POST', '/api/v1/developer/api-keys', token, {
      body: {},
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(422);
  });

  it('should return 422 for invalid scope', async () => {
    const req = buildAuthRequest('POST', '/api/v1/developer/api-keys', token, {
      body: { name: 'Test Key', scope: 'superadmin' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(422);
  });

  it('should create API key successfully', async () => {
    prismaMock.apiKey.count.mockResolvedValue(0);
    prismaMock.apiKey.create.mockResolvedValue({
      id: 'key-new',
      name: 'My New Key',
      keyPrefix: 'tt_12345678',
      scope: 'write',
      status: 'active',
      expiresAt: null,
      createdAt: new Date(),
    });

    const req = buildAuthRequest('POST', '/api/v1/developer/api-keys', token, {
      body: { name: 'My New Key', scope: 'write' },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.data.name).toBe('My New Key');
    expect(body.data.key).toBeTruthy();
    expect(body.data.key.startsWith('tt_')).toBe(true);
    expect(body.message).toContain('Store this key securely');
  });

  it('should enforce 10 key limit', async () => {
    prismaMock.apiKey.count.mockResolvedValue(10);

    const req = buildAuthRequest('POST', '/api/v1/developer/api-keys', token, {
      body: { name: 'One More Key' },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error.error).toContain('Maximum');
  });

  it('should support expiration', async () => {
    prismaMock.apiKey.count.mockResolvedValue(0);
    prismaMock.apiKey.create.mockImplementation(async ({ data }) => ({
      id: 'key-exp',
      name: data.name,
      keyPrefix: data.keyPrefix,
      scope: data.scope,
      status: 'active',
      expiresAt: data.expiresAt,
      createdAt: new Date(),
    }));

    const req = buildAuthRequest('POST', '/api/v1/developer/api-keys', token, {
      body: { name: 'Temp Key', scope: 'read', expiresInDays: 30 },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.data.expiresAt).toBeTruthy();
  });
});
