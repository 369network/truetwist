/**
 * Tests for middleware layer: CSRF, rate-limit, api-key, auth.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks (must be before imports) ──

const mockPipeline = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  pexpire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

vi.mock('@/lib/redis', () => ({
  redis: { pipeline: () => mockPipeline },
  getRedis: () => ({ pipeline: () => mockPipeline }),
}));

const prismaMock = {
  apiKey: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

// ── Top-level imports ──

const { generateCsrfToken, validateCsrf } = await import('@/middleware/csrf');
const { checkRateLimit, getRateLimitForPlan } = await import('@/middleware/rate-limit');
const { getApiKeyUser, requireScope } = await import('@/middleware/api-key');

beforeEach(() => {
  vi.clearAllMocks();
});

// ── CSRF middleware ──

describe('CSRF middleware', () => {
  it('generateCsrfToken should return hex string of expected length', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateCsrfToken should produce unique tokens', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });

  it('should skip validation for GET requests', () => {
    const req = new NextRequest(new URL('http://localhost:3000/api/test'), { method: 'GET' });
    expect(() => validateCsrf(req)).not.toThrow();
  });

  it('should skip validation for Bearer-authenticated requests', () => {
    const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer some-jwt-token' },
    });
    expect(() => validateCsrf(req)).not.toThrow();
  });

  it('should skip validation for webhook endpoints', () => {
    const req = new NextRequest(new URL('http://localhost:3000/api/webhooks/stripe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(() => validateCsrf(req)).not.toThrow();
  });

  it('should throw when CSRF token is missing', () => {
    const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(() => validateCsrf(req)).toThrow('Missing CSRF token');
  });

  it('should throw when header and cookie tokens do not match', () => {
    const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'header-token-value',
        Cookie: '__Host-csrf-token=different-cookie-value',
      },
    });
    expect(() => validateCsrf(req)).toThrow(/CSRF/i);
  });

  it('should pass when header and cookie tokens match', () => {
    const token = generateCsrfToken();
    const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        Cookie: `__Host-csrf-token=${token}`,
      },
    });
    expect(() => validateCsrf(req)).not.toThrow();
  });

  it('should enforce on PUT, PATCH, DELETE methods', () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method,
        headers: { 'Content-Type': 'application/json' },
      });
      expect(() => validateCsrf(req)).toThrow('Missing CSRF token');
    }
  });
});

// ── Rate Limit middleware ──

describe('Rate limit middleware', () => {
  describe('getRateLimitForPlan', () => {
    it('should return correct limits for each plan', () => {
      expect(getRateLimitForPlan('free')).toBe(30);
      expect(getRateLimitForPlan('starter')).toBe(120);
      expect(getRateLimitForPlan('pro')).toBe(300);
      expect(getRateLimitForPlan('enterprise')).toBe(1000);
    });

    it('should default to free plan for unknown plans', () => {
      expect(getRateLimitForPlan('unknown')).toBe(30);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests under the limit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0], [null, 1], [null, 5], [null, 1],
      ]);
      const result = await checkRateLimit('user-123', { windowMs: 60000, max: 60 });
      expect(result.remaining).toBe(55);
      expect(result.reset).toBeGreaterThan(0);
    });

    it('should throw when rate limit exceeded', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0], [null, 1], [null, 61], [null, 1],
      ]);
      await expect(checkRateLimit('user-123', { windowMs: 60000, max: 60 })).rejects.toThrow();
    });

    it('should use default config when none provided', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0], [null, 1], [null, 1], [null, 1],
      ]);
      const result = await checkRateLimit('user-456');
      expect(result.remaining).toBe(59);
    });
  });
});

// ── API Key middleware ──

describe('API Key middleware', () => {
  describe('getApiKeyUser', () => {
    it('should reject requests without API key', async () => {
      const req = new NextRequest(new URL('http://localhost:3000/api/test'), { method: 'GET' });
      await expect(getApiKeyUser(req)).rejects.toThrow('Missing or invalid API key');
    });

    it('should reject non-tt_ keys', async () => {
      const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method: 'GET',
        headers: { 'x-api-key': 'sk_invalid_key' },
      });
      await expect(getApiKeyUser(req)).rejects.toThrow('Missing or invalid API key');
    });

    it('should reject unknown API key', async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(null);
      const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method: 'GET',
        headers: { 'x-api-key': 'tt_' + 'a'.repeat(64) },
      });
      await expect(getApiKeyUser(req)).rejects.toThrow('Invalid API key');
    });

    it('should reject revoked key', async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: 'key-1', status: 'revoked',
        user: { id: 'user-1', plan: 'pro', email: 'test@test.com' },
      });
      const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method: 'GET', headers: { 'x-api-key': 'tt_' + 'b'.repeat(64) },
      });
      await expect(getApiKeyUser(req)).rejects.toThrow('revoked');
    });

    it('should reject expired key', async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: 'key-1', status: 'expired', expiresAt: new Date(Date.now() - 86400000),
        user: { id: 'user-1', plan: 'pro', email: 'test@test.com' },
      });
      const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method: 'GET', headers: { 'x-api-key': 'tt_' + 'c'.repeat(64) },
      });
      await expect(getApiKeyUser(req)).rejects.toThrow('expired');
    });

    it('should reject free plan users', async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: 'key-1', status: 'active', scope: 'read', userId: 'user-1',
        expiresAt: null, rotatedFromId: null, rotationGraceEndsAt: null,
        user: { id: 'user-1', plan: 'free', email: 'test@test.com' },
      });
      const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method: 'GET', headers: { 'x-api-key': 'tt_' + 'd'.repeat(64) },
      });
      await expect(getApiKeyUser(req)).rejects.toThrow('paid plan');
    });

    it('should return payload for valid active key', async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: 'key-1', status: 'active', scope: 'write', userId: 'user-1',
        expiresAt: null, rotatedFromId: null, rotationGraceEndsAt: null,
        user: { id: 'user-1', plan: 'pro', email: 'test@test.com' },
      });
      const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method: 'GET', headers: { 'x-api-key': 'tt_' + 'e'.repeat(64) },
      });
      const payload = await getApiKeyUser(req);
      expect(payload.sub).toBe('user-1');
      expect(payload.keyId).toBe('key-1');
      expect(payload.scope).toBe('write');
      expect(payload.plan).toBe('pro');
    });

    it('should accept key from Authorization Bearer header', async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: 'key-1', status: 'active', scope: 'read', userId: 'user-1',
        expiresAt: null, rotatedFromId: null, rotationGraceEndsAt: null,
        user: { id: 'user-1', plan: 'starter', email: 'test@test.com' },
      });
      const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method: 'GET', headers: { Authorization: 'Bearer tt_' + 'f'.repeat(64) },
      });
      const payload = await getApiKeyUser(req);
      expect(payload.sub).toBe('user-1');
    });
  });

  describe('requireScope', () => {
    it('should allow matching scope', () => {
      expect(() => requireScope({ sub: 'u', keyId: 'k', scope: 'write', plan: 'pro' }, 'write')).not.toThrow();
    });

    it('should allow higher scope', () => {
      expect(() => requireScope({ sub: 'u', keyId: 'k', scope: 'admin', plan: 'pro' }, 'read')).not.toThrow();
      expect(() => requireScope({ sub: 'u', keyId: 'k', scope: 'admin', plan: 'pro' }, 'write')).not.toThrow();
    });

    it('should reject insufficient scope', () => {
      expect(() => requireScope({ sub: 'u', keyId: 'k', scope: 'read', plan: 'pro' }, 'write')).toThrow('write');
      expect(() => requireScope({ sub: 'u', keyId: 'k', scope: 'read', plan: 'pro' }, 'admin')).toThrow('admin');
      expect(() => requireScope({ sub: 'u', keyId: 'k', scope: 'write', plan: 'pro' }, 'admin')).toThrow('admin');
    });
  });
});
