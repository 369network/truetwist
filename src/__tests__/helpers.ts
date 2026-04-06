/**
 * Shared test helpers for TrueTwist integration & E2E tests.
 * Provides mock factories, request builders, and common test data.
 */
import { vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── Environment setup (must run before auth module loads) ──
process.env.JWT_SECRET = 'test-jwt-secret-for-tests';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-tests';
process.env.REDIS_URL = 'redis://localhost:6379';

// ── Mock user data ──

export const TEST_USER = {
  id: 'user-test-001',
  email: 'alice@example.com',
  name: 'Alice Test',
  plan: 'free' as const,
  avatarUrl: null,
  hashedPassword: '$2a$12$placeholder',
  onboardingCompleted: false,
  provider: 'email',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

export const TEST_USER_2 = {
  id: 'user-test-002',
  email: 'bob@example.com',
  name: 'Bob Other',
  plan: 'pro' as const,
  avatarUrl: null,
  hashedPassword: '$2a$12$placeholder',
  onboardingCompleted: true,
  provider: 'email',
  createdAt: new Date('2026-01-02'),
  updatedAt: new Date('2026-01-02'),
};

export const TEST_BUSINESS = {
  id: 'b1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
  userId: TEST_USER.id,
  name: 'Test Co',
  industry: 'technology',
  description: 'A test business',
  website: 'https://test.co',
  brandVoice: 'professional',
  logoUrl: null,
  colors: null,
  targetAudience: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

export const TEST_POST = {
  id: 'post-test-001',
  userId: TEST_USER.id,
  businessId: TEST_BUSINESS.id,
  contentText: 'Hello world! This is a test post.',
  contentType: 'text' as const,
  status: 'draft' as const,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
};

export const TEST_SOCIAL_ACCOUNT = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  userId: TEST_USER.id,
  platform: 'twitter' as const,
  accountName: 'Test Account',
  accountHandle: '@testco',
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  platformUserId: 'platform-123',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// ── Request builder ──

export function buildRequest(
  method: string,
  url: string,
  options?: { body?: unknown; headers?: Record<string, string> }
): NextRequest {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}

export function buildAuthRequest(
  method: string,
  url: string,
  token: string,
  options?: { body?: unknown; headers?: Record<string, string> }
): NextRequest {
  return buildRequest(method, url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
}

// ── Prisma mock factory ──

export function createPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    business: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    post: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    postSchedule: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    socialAccount: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((fns: unknown[]) => Promise.all(fns)),
  };
}

// ── Response parser ──

export async function parseResponse(response: Response) {
  const json = await response.json();
  return { status: response.status, body: json };
}
