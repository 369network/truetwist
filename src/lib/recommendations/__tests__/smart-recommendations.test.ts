import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    optimalPostingTime: { findMany: vi.fn() },
    postSchedule: { findMany: vi.fn(), count: vi.fn() },
    competitorAccount: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
    socialAccount: { findFirst: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  getBestTimeRecommendations,
  getPostingFrequencyRecommendation,
  getContentMixRecommendation,
  getHashtagStrategyRecommendation,
  getGrowthTacticRecommendations,
  determineAccountStage,
} from '../smart-recommendations';

const mockOptimalTimes = prisma.optimalPostingTime.findMany as unknown as ReturnType<typeof vi.fn>;
const mockPostScheduleCount = prisma.postSchedule.count as unknown as ReturnType<typeof vi.fn>;
const mockPostScheduleFindMany = prisma.postSchedule.findMany as unknown as ReturnType<typeof vi.fn>;
const mockCompetitorAccount = prisma.competitorAccount.findMany as unknown as ReturnType<typeof vi.fn>;
const mockPostFindMany = prisma.post.findMany as unknown as ReturnType<typeof vi.fn>;
const mockSocialAccountFindFirst = prisma.socialAccount.findFirst as unknown as ReturnType<typeof vi.fn>;

describe('Smart Recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('determineAccountStage', () => {
    it('should return "new" for low followers', () => {
      expect(determineAccountStage(500, 120)).toBe('new');
    });

    it('should return "new" for new accounts regardless of followers', () => {
      expect(determineAccountStage(5000, 30)).toBe('new');
    });

    it('should return "growing" for mid-range accounts', () => {
      expect(determineAccountStage(5000, 120)).toBe('growing');
    });

    it('should return "established" for large accounts', () => {
      expect(determineAccountStage(15000, 365)).toBe('established');
    });
  });

  describe('getBestTimeRecommendations', () => {
    it('should return low data quality when no stored times', async () => {
      mockOptimalTimes.mockResolvedValue([]);

      const result = await getBestTimeRecommendations('user-1', 'account-1', 'instagram');

      expect(result.platform).toBe('instagram');
      expect(result.socialAccountId).toBe('account-1');
      expect(result.dataQuality).toBe('low');
      expect(result.slots).toEqual([]);
    });

    it('should return high data quality with sufficient samples', async () => {
      const storedTimes = Array.from({ length: 10 }, (_, i) => ({
        id: `opt-${i}`,
        socialAccountId: 'account-1',
        platform: 'instagram',
        dayOfWeek: i % 7,
        hourUtc: 10 + i,
        score: 0.9 - i * 0.05,
        sampleSize: 25,
        updatedAt: new Date(),
      }));

      mockOptimalTimes.mockResolvedValue(storedTimes);

      const result = await getBestTimeRecommendations('user-1', 'account-1', 'instagram');

      expect(result.dataQuality).toBe('high');
      expect(result.slots.length).toBe(10);
      result.slots.forEach((slot) => {
        expect(slot.label).toContain('UTC');
        expect(slot.score).toBeGreaterThan(0);
      });
    });
  });

  describe('getPostingFrequencyRecommendation', () => {
    it('should recommend increasing when below minimum', async () => {
      mockPostScheduleCount.mockResolvedValue(2);
      mockCompetitorAccount.mockResolvedValue([]);

      const result = await getPostingFrequencyRecommendation(
        'user-1', 'biz-1', 'instagram', 'account-1'
      );

      expect(result.platform).toBe('instagram');
      expect(result.currentFrequency).toBeLessThan(3);
      expect(result.recommendedFrequency).toBeGreaterThanOrEqual(3);
      expect(result.reasoning).toContain('below');
    });

    it('should recommend reducing when above max', async () => {
      mockPostScheduleCount.mockResolvedValue(60);
      mockCompetitorAccount.mockResolvedValue([]);

      const result = await getPostingFrequencyRecommendation(
        'user-1', 'biz-1', 'instagram', 'account-1'
      );

      expect(result.currentFrequency).toBeGreaterThan(7);
      expect(result.reasoning).toContain('above');
    });

    it('should factor in competitor frequency', async () => {
      mockPostScheduleCount.mockResolvedValue(9);
      mockCompetitorAccount.mockResolvedValue([
        { postingFrequency: 10 },
        { postingFrequency: 12 },
      ]);

      const result = await getPostingFrequencyRecommendation(
        'user-1', 'biz-1', 'instagram', 'account-1'
      );

      expect(result.competitorAvgFrequency).toBeGreaterThan(0);
    });
  });

  describe('getContentMixRecommendation', () => {
    it('should identify gaps between current and recommended mix', async () => {
      mockPostFindMany.mockResolvedValue([
        { contentType: 'text' },
        { contentType: 'text' },
        { contentType: 'text' },
        { contentType: 'text' },
        { contentType: 'image' },
      ]);
      mockCompetitorAccount.mockResolvedValue([]);

      const result = await getContentMixRecommendation('user-1', 'biz-1', 'instagram');

      expect(result.currentMix.text).toBe(80);
      expect(result.recommendedMix).toHaveProperty('image');
      expect(result.recommendedMix).toHaveProperty('video');
      expect(result.gaps.length).toBeGreaterThan(0);
    });

    it('should handle empty post history', async () => {
      mockPostFindMany.mockResolvedValue([]);
      mockCompetitorAccount.mockResolvedValue([]);

      const result = await getContentMixRecommendation('user-1', 'biz-1', 'tiktok');

      expect(result.currentMix).toEqual({});
      expect(result.recommendedMix.video).toBe(90);
    });
  });

  describe('getHashtagStrategyRecommendation', () => {
    it('should return strategy with optimal count per platform', async () => {
      mockPostScheduleFindMany.mockResolvedValue([]);
      mockCompetitorAccount.mockResolvedValue([]);

      const result = await getHashtagStrategyRecommendation('user-1', 'biz-1', 'instagram');

      expect(result.platform).toBe('instagram');
      expect(result.optimalCount).toBe(15);
      expect(Array.isArray(result.consistentHashtags)).toBe(true);
      expect(Array.isArray(result.rotatingHashtags)).toBe(true);
      expect(Array.isArray(result.trendingHashtags)).toBe(true);
      expect(Array.isArray(result.avoidHashtags)).toBe(true);
    });

    it('should identify consistent hashtags from repeated high-performers', async () => {
      const makeSchedule = (text: string, engagement: number) => ({
        id: `s-${Math.random()}`,
        post: { contentText: text },
        analytics: [{
          likes: engagement,
          comments: Math.floor(engagement / 5),
          shares: Math.floor(engagement / 10),
          saves: 0,
          clicks: 0,
          fetchedAt: new Date(),
        }],
        postedAt: new Date(),
      });

      mockPostScheduleFindMany.mockResolvedValue([
        makeSchedule('Great post #marketing #growth #business', 100),
        makeSchedule('Another great one #marketing #tips', 80),
        makeSchedule('Keep going #marketing #growth #strategy', 120),
        makeSchedule('More content #marketing #seo', 90),
      ]);
      mockCompetitorAccount.mockResolvedValue([]);

      const result = await getHashtagStrategyRecommendation('user-1', 'biz-1', 'twitter');

      expect(result.optimalCount).toBe(3);
      expect(result.consistentHashtags).toContain('marketing');
    });
  });

  describe('getGrowthTacticRecommendations', () => {
    it('should return tactics for new accounts', async () => {
      mockSocialAccountFindFirst.mockResolvedValue({
        id: 'account-1',
        userId: 'user-1',
        followerCount: 200,
        connectedAt: new Date(),
      });

      const result = await getGrowthTacticRecommendations('user-1', 'account-1', 'instagram');

      expect(result.accountStage).toBe('new');
      expect(result.platform).toBe('instagram');
      expect(result.tactics.length).toBeGreaterThan(0);
      result.tactics.forEach((t) => {
        expect(t).toHaveProperty('title');
        expect(t).toHaveProperty('description');
        expect(t).toHaveProperty('priority');
        expect(t).toHaveProperty('category');
        expect(t).toHaveProperty('estimatedImpact');
      });
    });

    it('should return established tactics for large accounts', async () => {
      mockSocialAccountFindFirst.mockResolvedValue({
        id: 'account-1',
        userId: 'user-1',
        followerCount: 50000,
        connectedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      });

      const result = await getGrowthTacticRecommendations('user-1', 'account-1', 'tiktok');

      expect(result.accountStage).toBe('established');
      expect(result.platform).toBe('tiktok');
      expect(result.tactics.length).toBeGreaterThan(0);
    });
  });
});
