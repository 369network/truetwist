/**
 * Tests for /api/v1/schedules — schedule creation and listing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TEST_USER,
  TEST_POST,
  TEST_SOCIAL_ACCOUNT,
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
vi.mock('@/lib/scheduling', () => ({
  postLifecycle: {
    schedulePost: vi.fn().mockResolvedValue({
      id: 'sched-001',
      postId: 'post-test-001',
      status: 'scheduled',
    }),
  },
}));
vi.mock('@/middleware/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ remaining: 5, reset: Date.now() + 60000 }),
  getRateLimitForPlan: vi.fn().mockReturnValue(60),
}));

const { POST, GET } = await import('@/app/api/v1/schedules/route');

const token = generateAccessToken(TEST_USER.id, TEST_USER.email, TEST_USER.plan as PlanTier);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/v1/schedules', () => {
  it('should return 401 without auth token', async () => {
    const req = new (await import('next/server')).NextRequest(
      new URL('http://localhost:3000/api/v1/schedules'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it('should return 422 for missing required fields', async () => {
    const req = buildAuthRequest('POST', '/api/v1/schedules', token, {
      body: {},
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(422);
    expect(body.error).toBeTruthy();
  });

  it('should return 404 when post not found', async () => {
    prismaMock.post.findFirst.mockResolvedValue(null);

    const req = buildAuthRequest('POST', '/api/v1/schedules', token, {
      body: {
        postId: '00000000-0000-4000-a000-000000000099',
        platforms: [{
          socialAccountId: TEST_SOCIAL_ACCOUNT.id,
          platform: 'twitter',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        }],
      },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it('should schedule a post successfully', async () => {
    prismaMock.post.findFirst.mockResolvedValue({ ...TEST_POST, status: 'draft' });
    prismaMock.socialAccount.findMany.mockResolvedValue([TEST_SOCIAL_ACCOUNT]);

    const req = buildAuthRequest('POST', '/api/v1/schedules', token, {
      body: {
        postId: TEST_POST.id,
        platforms: [{
          socialAccountId: TEST_SOCIAL_ACCOUNT.id,
          platform: 'twitter',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        }],
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body.data).toBeTruthy();
  });
});

describe('GET /api/v1/schedules', () => {
  it('should return 401 without auth', async () => {
    const req = new (await import('next/server')).NextRequest(
      new URL('http://localhost:3000/api/v1/schedules'),
      { method: 'GET' }
    );
    const res = await GET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it('should list schedules for authenticated user', async () => {
    prismaMock.postSchedule.findMany.mockResolvedValue([]);
    prismaMock.postSchedule.count.mockResolvedValue(0);

    const req = buildAuthRequest('GET', '/api/v1/schedules', token);
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
  });

  it('should support pagination and filters', async () => {
    prismaMock.postSchedule.findMany.mockResolvedValue([]);
    prismaMock.postSchedule.count.mockResolvedValue(0);

    const req = buildAuthRequest(
      'GET',
      '/api/v1/schedules?page=2&pageSize=10&platform=twitter&status=scheduled',
      token
    );
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(10);
  });
});
