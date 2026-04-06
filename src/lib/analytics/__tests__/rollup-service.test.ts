import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RollupService } from '../rollup-service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    postSchedule: {
      findMany: vi.fn(),
    },
    socialAccount: {
      findMany: vi.fn(),
    },
    analyticsRollup: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    close: vi.fn(),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    close: vi.fn(),
  })),
}));

import { prisma } from '@/lib/prisma';
import Redis from 'ioredis';

describe('RollupService', () => {
  let service: RollupService;
  const mockRedis = {} as Redis;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RollupService(mockRedis);
  });

  describe('computeRollup', () => {
    it('should aggregate metrics across schedules and upsert rollups', async () => {
      vi.mocked(prisma.postSchedule.findMany).mockResolvedValue([
        {
          id: 's1',
          scheduledAt: new Date('2026-03-15T10:00:00Z'),
          post: { contentType: 'image' },
          socialAccount: { platform: 'instagram', followerCount: 1000 },
          analytics: [{
            impressions: 500, reach: 400, likes: 30, comments: 10,
            shares: 5, saves: 3, clicks: 15,
          }],
        },
        {
          id: 's2',
          scheduledAt: new Date('2026-03-15T14:00:00Z'),
          post: { contentType: 'text' },
          socialAccount: { platform: 'instagram', followerCount: 1000 },
          analytics: [{
            impressions: 300, reach: 250, likes: 20, comments: 5,
            shares: 2, saves: 1, clicks: 8,
          }],
        },
      ] as any);

      vi.mocked(prisma.socialAccount.findMany).mockResolvedValue([
        { followerCount: 1000 },
      ] as any);

      vi.mocked(prisma.analyticsRollup.upsert).mockResolvedValue({} as any);

      await service.computeRollup({
        userId: 'user-1',
        period: 'daily',
        periodStart: '2026-03-15T00:00:00Z',
        periodEnd: '2026-03-15T23:59:59Z',
      });

      // Should upsert for instagram platform + null (cross-platform)
      expect(prisma.analyticsRollup.upsert).toHaveBeenCalledTimes(2);

      // Check the instagram-specific rollup
      const instagramCall = vi.mocked(prisma.analyticsRollup.upsert).mock.calls.find(
        call => call[0].create.platform === 'instagram'
      );
      expect(instagramCall).toBeDefined();
      expect(instagramCall![0].create.impressions).toBe(800);
      expect(instagramCall![0].create.likes).toBe(50);

      // Check the cross-platform rollup
      const crossPlatformCall = vi.mocked(prisma.analyticsRollup.upsert).mock.calls.find(
        call => call[0].create.platform === undefined
      );
      expect(crossPlatformCall).toBeDefined();
      expect(crossPlatformCall![0].create.impressions).toBe(800);
    });

    it('should handle empty schedules gracefully', async () => {
      vi.mocked(prisma.postSchedule.findMany).mockResolvedValue([]);
      vi.mocked(prisma.socialAccount.findMany).mockResolvedValue([]);
      vi.mocked(prisma.analyticsRollup.upsert).mockResolvedValue({} as any);

      await service.computeRollup({
        userId: 'user-1',
        period: 'daily',
        periodStart: '2026-03-15T00:00:00Z',
        periodEnd: '2026-03-15T23:59:59Z',
      });

      // Should still upsert the aggregate rollup
      expect(prisma.analyticsRollup.upsert).toHaveBeenCalledTimes(1);
    });

    it('should compute content type breakdown', async () => {
      vi.mocked(prisma.postSchedule.findMany).mockResolvedValue([
        {
          scheduledAt: new Date('2026-03-15T10:00:00Z'),
          post: { contentType: 'image' },
          socialAccount: { platform: 'twitter', followerCount: 500 },
          analytics: [{ impressions: 100, reach: 80, likes: 10, comments: 2, shares: 1, saves: 0, clicks: 5 }],
        },
        {
          scheduledAt: new Date('2026-03-15T12:00:00Z'),
          post: { contentType: 'image' },
          socialAccount: { platform: 'twitter', followerCount: 500 },
          analytics: [{ impressions: 200, reach: 150, likes: 15, comments: 3, shares: 2, saves: 1, clicks: 8 }],
        },
        {
          scheduledAt: new Date('2026-03-15T14:00:00Z'),
          post: { contentType: 'video' },
          socialAccount: { platform: 'twitter', followerCount: 500 },
          analytics: [{ impressions: 300, reach: 250, likes: 40, comments: 10, shares: 5, saves: 2, clicks: 15 }],
        },
      ] as any);

      vi.mocked(prisma.socialAccount.findMany).mockResolvedValue([
        { followerCount: 500 },
      ] as any);
      vi.mocked(prisma.analyticsRollup.upsert).mockResolvedValue({} as any);

      await service.computeRollup({
        userId: 'user-1',
        period: 'daily',
        periodStart: '2026-03-15T00:00:00Z',
        periodEnd: '2026-03-15T23:59:59Z',
      });

      const crossPlatformCall = vi.mocked(prisma.analyticsRollup.upsert).mock.calls.find(
        call => call[0].create.platform === undefined
      );
      expect(crossPlatformCall![0].create.contentBreakdown).toEqual({ image: 2, video: 1 });
    });
  });
});
