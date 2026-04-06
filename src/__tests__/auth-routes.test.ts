/**
 * Integration tests for auth API routes: register, login, refresh.
 * Tests request validation, error handling, and auth flow correctness.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import {
  TEST_USER,
  buildRequest,
  createPrismaMock,
  parseResponse,
} from './helpers';

// ── Mocks ──

const prismaMock = createPrismaMock();
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/email', () => ({ sendWelcomeEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/middleware/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ remaining: 5, reset: Date.now() + 60000 }),
  getRateLimitForPlan: vi.fn().mockReturnValue(60),
}));

// Import route handlers after mocks
const { POST: registerHandler } = await import('@/app/api/v1/auth/register/route');
const { POST: loginHandler } = await import('@/app/api/v1/auth/login/route');
const { POST: refreshHandler } = await import('@/app/api/v1/auth/refresh/route');

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Register ──

describe('POST /api/v1/auth/register', () => {
  it('should register a new user successfully', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'new-user-id',
      email: 'new@example.com',
      name: 'New User',
      plan: 'free',
      avatarUrl: null,
      onboardingCompleted: false,
      createdAt: new Date(),
    });
    prismaMock.refreshToken.create.mockResolvedValue({});

    const req = buildRequest('POST', '/api/v1/auth/register', {
      body: { email: 'new@example.com', password: 'StrongPass1', name: 'New User' },
    });

    const res = await registerHandler(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.data.user.email).toBe('new@example.com');
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
  });

  it('should reject duplicate email', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const req = buildRequest('POST', '/api/v1/auth/register', {
      body: { email: TEST_USER.email, password: 'StrongPass1', name: 'Dup' },
    });

    const res = await registerHandler(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('should reject weak password (no uppercase)', async () => {
    const req = buildRequest('POST', '/api/v1/auth/register', {
      body: { email: 'x@example.com', password: 'nouppercase1', name: 'Test' },
    });

    const res = await registerHandler(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject weak password (no number)', async () => {
    const req = buildRequest('POST', '/api/v1/auth/register', {
      body: { email: 'x@example.com', password: 'NoNumberHere', name: 'Test' },
    });

    const res = await registerHandler(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject short password', async () => {
    const req = buildRequest('POST', '/api/v1/auth/register', {
      body: { email: 'x@example.com', password: 'Sh0rt', name: 'Test' },
    });

    const res = await registerHandler(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject invalid email', async () => {
    const req = buildRequest('POST', '/api/v1/auth/register', {
      body: { email: 'not-an-email', password: 'StrongPass1', name: 'Test' },
    });

    const res = await registerHandler(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing name', async () => {
    const req = buildRequest('POST', '/api/v1/auth/register', {
      body: { email: 'x@example.com', password: 'StrongPass1' },
    });

    const res = await registerHandler(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(422);
  });
});

// ── Login ──

describe('POST /api/v1/auth/login', () => {
  it('should login with valid credentials', async () => {
    // We need a real bcrypt hash for 'StrongPass1'
    const { hashPassword } = await import('@/lib/auth');
    const hash = await hashPassword('StrongPass1');

    prismaMock.user.findUnique.mockResolvedValue({
      ...TEST_USER,
      hashedPassword: hash,
    });
    prismaMock.refreshToken.create.mockResolvedValue({});

    const req = buildRequest('POST', '/api/v1/auth/login', {
      body: { email: TEST_USER.email, password: 'StrongPass1' },
    });

    const res = await loginHandler(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.user.email).toBe(TEST_USER.email);
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
    // Ensure hashedPassword is NOT returned
    expect(body.data.user.hashedPassword).toBeUndefined();
  });

  it('should reject wrong password', async () => {
    const { hashPassword } = await import('@/lib/auth');
    const hash = await hashPassword('CorrectPass1');

    prismaMock.user.findUnique.mockResolvedValue({
      ...TEST_USER,
      hashedPassword: hash,
    });

    const req = buildRequest('POST', '/api/v1/auth/login', {
      body: { email: TEST_USER.email, password: 'WrongPass1' },
    });

    const res = await loginHandler(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject non-existent user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const req = buildRequest('POST', '/api/v1/auth/login', {
      body: { email: 'nobody@example.com', password: 'StrongPass1' },
    });

    const res = await loginHandler(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    // Same error message for both missing user and wrong password (avoids enumeration)
    expect(body.error.error).toBe('Invalid email or password');
  });

  it('should reject empty body', async () => {
    const req = buildRequest('POST', '/api/v1/auth/login', {
      body: {},
    });

    const res = await loginHandler(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(422);
  });
});

// ── Refresh ──

describe('POST /api/v1/auth/refresh', () => {
  it('should rotate tokens successfully', async () => {
    const { generateRefreshToken, hashToken } = await import('@/lib/auth');
    const { token, jti } = generateRefreshToken(TEST_USER.id);

    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: jti,
      userId: TEST_USER.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 86400000),
      revokedAt: null,
      replacedBy: null,
    });

    prismaMock.user.findUnique.mockResolvedValue({
      id: TEST_USER.id,
      email: TEST_USER.email,
      plan: TEST_USER.plan,
    });

    prismaMock.$transaction.mockImplementation(async (fns: unknown[]) => {
      if (Array.isArray(fns)) return fns;
      return [];
    });

    const req = buildRequest('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: token },
    });

    const res = await refreshHandler(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
    expect(body.data.refreshToken).not.toBe(token); // rotated
  });

  it('should reject revoked token and revoke all user tokens', async () => {
    const { generateRefreshToken, hashToken } = await import('@/lib/auth');
    const { token, jti } = generateRefreshToken(TEST_USER.id);

    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: jti,
      userId: TEST_USER.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 86400000),
      revokedAt: new Date(), // already revoked
      replacedBy: null,
    });
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 3 });

    const req = buildRequest('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: token },
    });

    const res = await refreshHandler(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(body.error.error).toBe('Token has been revoked');
    // Should have revoked all tokens for the user (token reuse detection)
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER.id },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    );
  });

  it('should reject invalid refresh token', async () => {
    const req = buildRequest('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: 'invalid-token' },
    });

    const res = await refreshHandler(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it('should reject missing refresh token field', async () => {
    const req = buildRequest('POST', '/api/v1/auth/refresh', {
      body: {},
    });

    const res = await refreshHandler(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(422);
  });
});
