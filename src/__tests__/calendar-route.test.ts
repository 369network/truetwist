/**
 * Tests for GET /api/v1/calendar — calendar view endpoint.
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

const { GET } = await import('@/app/api/v1/calendar/route');

const token = generateAccessToken(TEST_USER.id, TEST_USER.email, TEST_USER.plan as PlanTier);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/calendar', () => {
  it('should return 401 without auth', async () => {
    const req = new (await import('next/server')).NextRequest(
      new URL('http://localhost:3000/api/v1/calendar'),
      { method: 'GET' }
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('should return week view by default', async () => {
    prismaMock.postSchedule.findMany.mockResolvedValue([]);

    const req = buildAuthRequest('GET', '/api/v1/calendar', token);
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.view).toBe('week');
    expect(body.data.days).toHaveLength(7);
    expect(body.data.totalSchedules).toBe(0);
  });

  it('should support month view', async () => {
    prismaMock.postSchedule.findMany.mockResolvedValue([]);

    const req = buildAuthRequest('GET', '/api/v1/calendar?view=month&date=2026-04-01', token);
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.view).toBe('month');
    expect(body.data.days.length).toBe(30); // April has 30 days
  });

  it('should support day view', async () => {
    prismaMock.postSchedule.findMany.mockResolvedValue([]);

    const req = buildAuthRequest('GET', '/api/v1/calendar?view=day&date=2026-04-07', token);
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.view).toBe('day');
    expect(body.data.days).toHaveLength(1);
    expect(body.data.days[0].date).toBe('2026-04-07');
  });

  it('should group schedules by date', async () => {
    prismaMock.postSchedule.findMany.mockResolvedValue([
      {
        id: 'sched-1',
        scheduledAt: new Date('2026-04-07T10:00:00Z'),
        platform: 'twitter',
        status: 'scheduled',
        postedAt: null,
        crossPostGroup: null,
        post: {
          id: 'p1',
          contentText: 'Hello world',
          contentType: 'text',
          status: 'scheduled',
          business: { id: 'b1', name: 'Test Biz' },
          media: [],
        },
        socialAccount: {
          id: 'sa1',
          platform: 'twitter',
          accountName: 'Test',
          accountHandle: '@test',
        },
      },
    ]);

    const req = buildAuthRequest('GET', '/api/v1/calendar?view=day&date=2026-04-07', token);
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.totalSchedules).toBe(1);
    expect(body.data.days[0].totalPosts).toBe(1);
    expect(body.data.days[0].schedules[0].title).toBe('Hello world');
  });

  it('should support legacy start/end params', async () => {
    prismaMock.postSchedule.findMany.mockResolvedValue([]);

    const req = buildAuthRequest(
      'GET',
      '/api/v1/calendar?start=2026-04-01&end=2026-04-07',
      token
    );
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.days.length).toBeGreaterThanOrEqual(6);
  });

  it('should support platform filter', async () => {
    prismaMock.postSchedule.findMany.mockResolvedValue([]);

    const req = buildAuthRequest(
      'GET',
      '/api/v1/calendar?view=week&platform=instagram',
      token
    );
    const res = await GET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(200);
  });
});
