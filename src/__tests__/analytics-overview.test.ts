/**
 * Tests for GET /api/v1/analytics/overview — cross-platform analytics.
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

const { GET } = await import('@/app/api/v1/analytics/overview/route');

const token = generateAccessToken(TEST_USER.id, TEST_USER.email, TEST_USER.plan as PlanTier);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/analytics/overview', () => {
  it('should return 401 without auth', async () => {
    const req = new (await import('next/server')).NextRequest(
      new URL('http://localhost:3000/api/v1/analytics/overview'),
      { method: 'GET' }
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('should return empty analytics when no data', async () => {
    prismaMock.postSchedule.findMany.mockResolvedValue([]);
    prismaMock.socialAccount.findMany.mockResolvedValue([]);

    const req = buildAuthRequest('GET', '/api/v1/analytics/overview', token);
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.totalImpressions).toBe(0);
    expect(body.data.totalReach).toBe(0);
    expect(body.data.totalEngagements).toBe(0);
    expect(body.data.totalFollowers).toBe(0);
    expect(body.data.engagementRate).toBe(0);
    expect(body.data.postCount).toBe(0);
    expect(body.data.dateRange).toBeTruthy();
    expect(body.data.changes).toBeTruthy();
  });

  it('should calculate metrics from analytics data', async () => {
    prismaMock.postSchedule.findMany
      // Current period
      .mockResolvedValueOnce([
        {
          id: 's1',
          analytics: [{
            impressions: 1000,
            reach: 800,
            likes: 50,
            comments: 10,
            shares: 5,
            saves: 3,
            clicks: 25,
          }],
          socialAccount: { platform: 'twitter', followerCount: 5000 },
        },
        {
          id: 's2',
          analytics: [{
            impressions: 2000,
            reach: 1500,
            likes: 100,
            comments: 20,
            shares: 10,
            saves: 7,
            clicks: 50,
          }],
          socialAccount: { platform: 'instagram', followerCount: 10000 },
        },
      ])
      // Previous period
      .mockResolvedValueOnce([
        {
          id: 's3',
          analytics: [{
            impressions: 500,
            reach: 400,
            likes: 20,
            comments: 5,
            shares: 2,
            saves: 1,
            clicks: 10,
          }],
        },
      ]);

    prismaMock.socialAccount.findMany.mockResolvedValue([
      { followerCount: 5000 },
      { followerCount: 10000 },
    ]);

    const req = buildAuthRequest('GET', '/api/v1/analytics/overview', token);
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.totalImpressions).toBe(3000);
    expect(body.data.totalReach).toBe(2300);
    expect(body.data.totalEngagements).toBe(205); // 50+10+5+3 + 100+20+10+7
    expect(body.data.totalFollowers).toBe(15000);
    expect(body.data.totalClicks).toBe(75);
    expect(body.data.postCount).toBe(2);
    expect(body.data.engagementRate).toBeGreaterThan(0);
  });

  it('should support range parameter', async () => {
    prismaMock.postSchedule.findMany.mockResolvedValue([]);
    prismaMock.socialAccount.findMany.mockResolvedValue([]);

    const req = buildAuthRequest('GET', '/api/v1/analytics/overview?range=7d', token);
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.dateRange.days).toBe(7);
  });

  it('should support businessId filter', async () => {
    prismaMock.postSchedule.findMany.mockResolvedValue([]);
    prismaMock.socialAccount.findMany.mockResolvedValue([]);

    const req = buildAuthRequest(
      'GET',
      '/api/v1/analytics/overview?businessId=biz-123',
      token
    );
    const res = await GET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(200);
  });
});
