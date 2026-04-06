import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    postSchedule: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { generateWeeklyInsights } from '../performance-insights';

const mockPostScheduleFindMany = prisma.postSchedule.findMany as unknown as ReturnType<typeof vi.fn>;

describe('Performance Insights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateWeeklyInsights', () => {
    it('should handle no posts gracefully', async () => {
      mockPostScheduleFindMany.mockResolvedValue([]);

      const insights = await generateWeeklyInsights('user-1', 'biz-1', ['account-1']);

      expect(insights.userId).toBe('user-1');
      expect(insights.businessId).toBe('biz-1');
      expect(insights.summary).toContain('No posts');
      expect(insights.whatWorked).toEqual([]);
      expect(insights.topPerformingPosts).toEqual([]);
      expect(insights.overallEngagement.thisWeek).toBe(0);
      expect(insights.overallEngagement.lastWeek).toBe(0);
    });

    it('should calculate engagement changes between weeks', async () => {
      const now = new Date();
      const thisWeekDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const lastWeekDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      mockPostScheduleFindMany
        .mockResolvedValueOnce([
          {
            id: 's-1',
            platform: 'instagram',
            postedAt: thisWeekDate,
            post: { contentType: 'image', contentText: 'test', id: 'p-1' },
            analytics: [{
              likes: 200, comments: 50, shares: 20, saves: 10, clicks: 30,
              reach: 5000, impressions: 8000, fetchedAt: new Date(),
            }],
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 's-2',
            platform: 'instagram',
            postedAt: lastWeekDate,
            analytics: [{
              likes: 100, comments: 20, shares: 10, saves: 5, clicks: 15,
              reach: 2500, impressions: 4000, fetchedAt: new Date(),
            }],
          },
        ]);

      const insights = await generateWeeklyInsights('user-1', 'biz-1', ['account-1']);

      expect(insights.overallEngagement.thisWeek).toBeGreaterThan(0);
      expect(insights.overallEngagement.lastWeek).toBeGreaterThan(0);
      expect(insights.overallEngagement.changePercent).toBeGreaterThan(0);
      expect(insights.summary).toContain('1 post');
      expect(insights.topPerformingPosts.length).toBe(1);
      expect(insights.topPerformingPosts[0].platform).toBe('instagram');
    });

    it('should detect anomalies when metrics change significantly', async () => {
      const now = new Date();
      const thisWeekDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const lastWeekDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      mockPostScheduleFindMany
        .mockResolvedValueOnce([
          {
            id: 's-1',
            platform: 'instagram',
            postedAt: thisWeekDate,
            post: { contentType: 'image', contentText: 'viral post', id: 'p-1' },
            analytics: [{
              likes: 10000, comments: 500, shares: 200, saves: 100, clicks: 300,
              reach: 50000, impressions: 80000, fetchedAt: new Date(),
            }],
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 's-2',
            platform: 'instagram',
            postedAt: lastWeekDate,
            analytics: [{
              likes: 100, comments: 10, shares: 5, saves: 2, clicks: 10,
              reach: 1000, impressions: 2000, fetchedAt: new Date(),
            }],
          },
        ]);

      const insights = await generateWeeklyInsights('user-1', 'biz-1', ['account-1']);

      expect(insights.anomalies.length).toBeGreaterThan(0);
      const likeAnomaly = insights.anomalies.find((a) => a.metric === 'likes');
      expect(likeAnomaly?.type).toBe('spike');
      expect(likeAnomaly?.change).toBeGreaterThan(50);
    });

    it('should generate next week suggestions', async () => {
      mockPostScheduleFindMany
        .mockResolvedValueOnce([
          {
            id: 's-1',
            platform: 'instagram',
            postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            post: { contentType: 'text', contentText: 'test', id: 'p-1' },
            analytics: [{
              likes: 50, comments: 5, shares: 2, saves: 1, clicks: 3,
              reach: 500, impressions: 800, fetchedAt: new Date(),
            }],
          },
          {
            id: 's-2',
            platform: 'instagram',
            postedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            post: { contentType: 'text', contentText: 'test2', id: 'p-2' },
            analytics: [{
              likes: 40, comments: 3, shares: 1, saves: 0, clicks: 2,
              reach: 400, impressions: 600, fetchedAt: new Date(),
            }],
          },
          {
            id: 's-3',
            platform: 'instagram',
            postedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
            post: { contentType: 'text', contentText: 'test3', id: 'p-3' },
            analytics: [{
              likes: 30, comments: 2, shares: 0, saves: 0, clicks: 1,
              reach: 300, impressions: 500, fetchedAt: new Date(),
            }],
          },
        ])
        .mockResolvedValueOnce([]);

      const insights = await generateWeeklyInsights('user-1', 'biz-1', ['account-1']);

      expect(insights.whatToTryNextWeek.length).toBeGreaterThan(0);
      const diversifySuggestion = insights.whatToTryNextWeek.find(
        (s) => s.suggestion.toLowerCase().includes('diversif')
      );
      expect(diversifySuggestion).toBeDefined();
    });

    it('should identify what worked this week', async () => {
      const now = new Date();
      mockPostScheduleFindMany
        .mockResolvedValueOnce([
          {
            id: 's-1',
            platform: 'instagram',
            postedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            post: { contentType: 'video', contentText: 'video post', id: 'p-1' },
            analytics: [{
              likes: 500, comments: 100, shares: 50, saves: 25, clicks: 40,
              reach: 10000, impressions: 15000, fetchedAt: now,
            }],
          },
          {
            id: 's-2',
            platform: 'instagram',
            postedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
            post: { contentType: 'image', contentText: 'image post', id: 'p-2' },
            analytics: [{
              likes: 50, comments: 5, shares: 2, saves: 1, clicks: 3,
              reach: 1000, impressions: 1500, fetchedAt: now,
            }],
          },
        ])
        .mockResolvedValueOnce([]);

      const insights = await generateWeeklyInsights('user-1', 'biz-1', ['account-1']);

      expect(insights.whatWorked.length).toBeGreaterThan(0);
      expect(insights.whatWorked[0].pattern).toContain('video');
      expect(insights.whatWorked[0].postsCount).toBe(1);
    });
  });
});
