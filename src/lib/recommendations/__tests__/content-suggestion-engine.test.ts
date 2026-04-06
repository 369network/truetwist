import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    postSchedule: { findMany: vi.fn() },
    competitorPost: { findMany: vi.fn() },
    viralTrend: { findMany: vi.fn() },
    socialAccount: { findMany: vi.fn() },
    optimalPostingTime: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/scheduling', () => ({
  smartScheduler: {
    getOptimalSlots: vi.fn().mockResolvedValue([
      { scheduledAt: new Date('2026-04-07T14:00:00Z'), score: 0.9, isDefault: true },
    ]),
  },
}));

import { prisma } from '@/lib/prisma';
import {
  generateContentSuggestions,
  analyzeWinningPatterns,
  getUpcomingSeasonalEvents,
} from '../content-suggestion-engine';

// Use the same pattern as the existing smart-scheduler.test.ts
const mockBusiness = prisma.business.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockPostScheduleFindMany = prisma.postSchedule.findMany as unknown as ReturnType<typeof vi.fn>;
const mockCompetitorPost = prisma.competitorPost.findMany as unknown as ReturnType<typeof vi.fn>;
const mockViralTrend = prisma.viralTrend.findMany as unknown as ReturnType<typeof vi.fn>;

describe('Content Suggestion Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUpcomingSeasonalEvents', () => {
    it('should return events within the specified window', () => {
      const events = getUpcomingSeasonalEvents(365);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('name');
      expect(events[0]).toHaveProperty('month');
      expect(events[0]).toHaveProperty('day');
    });

    it('should return empty for very small window if no events are near', () => {
      const events = getUpcomingSeasonalEvents(0);
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('analyzeWinningPatterns', () => {
    it('should return empty array when no posts exist', async () => {
      mockPostScheduleFindMany.mockResolvedValue([]);
      const patterns = await analyzeWinningPatterns('user-1', 'biz-1');
      expect(patterns).toEqual([]);
    });

    it('should rank content types by average engagement', async () => {
      mockPostScheduleFindMany.mockResolvedValue([
        {
          id: 's-1',
          post: { contentType: 'image', contentText: 'test' },
          analytics: [{ likes: 100, comments: 20, shares: 10, saves: 5, clicks: 15, reach: 1000, fetchedAt: new Date() }],
          postedAt: new Date(),
        },
        {
          id: 's-2',
          post: { contentType: 'text', contentText: 'test' },
          analytics: [{ likes: 10, comments: 2, shares: 1, saves: 0, clicks: 3, reach: 500, fetchedAt: new Date() }],
          postedAt: new Date(),
        },
        {
          id: 's-3',
          post: { contentType: 'image', contentText: 'test2' },
          analytics: [{ likes: 200, comments: 40, shares: 20, saves: 10, clicks: 30, reach: 2000, fetchedAt: new Date() }],
          postedAt: new Date(),
        },
      ]);

      const patterns = await analyzeWinningPatterns('user-1', 'biz-1');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].contentType).toBe('image');
      expect(patterns[0].count).toBe(2);
    });
  });

  describe('generateContentSuggestions', () => {
    it('should return empty when business not found', async () => {
      mockBusiness.mockResolvedValue(null);
      const suggestions = await generateContentSuggestions({
        userId: 'user-1',
        businessId: 'nonexistent',
      });
      expect(suggestions).toEqual([]);
    });

    it('should return suggestions when business exists', async () => {
      mockBusiness.mockResolvedValue({
        id: 'biz-1',
        userId: 'user-1',
        name: 'Test Biz',
        industry: 'tech',
      });
      mockPostScheduleFindMany.mockResolvedValue([]);
      mockCompetitorPost.mockResolvedValue([]);
      mockViralTrend.mockResolvedValue([]);

      const suggestions = await generateContentSuggestions({
        userId: 'user-1',
        businessId: 'biz-1',
        count: 3,
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(3);
      suggestions.forEach((s) => {
        expect(s).toHaveProperty('title');
        expect(s).toHaveProperty('description');
        expect(s).toHaveProperty('contentType');
        expect(s).toHaveProperty('template');
        expect(s).toHaveProperty('confidence');
        expect(s).toHaveProperty('source');
        expect(s.confidence).toBeGreaterThan(0);
        expect(s.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should include competitor-inspired suggestions when viral posts exist', async () => {
      mockBusiness.mockResolvedValue({
        id: 'biz-1',
        userId: 'user-1',
        name: 'Test Biz',
      });
      mockPostScheduleFindMany.mockResolvedValue([]);
      mockViralTrend.mockResolvedValue([]);
      mockCompetitorPost.mockResolvedValue([
        {
          id: 'cp-1',
          contentType: 'video',
          hashtags: ['trending', 'viral'],
          engagementRate: 0.15,
          competitorAccount: {
            platform: 'instagram',
            competitor: { name: 'Competitor A' },
          },
        },
      ]);

      const suggestions = await generateContentSuggestions({
        userId: 'user-1',
        businessId: 'biz-1',
        count: 10,
        includeCompetitorInspired: true,
      });

      const competitorSuggestion = suggestions.find((s) => s.source === 'competitor');
      expect(competitorSuggestion).toBeDefined();
      expect(competitorSuggestion?.contentType).toBe('video');
    });

    it('should respect count limit', async () => {
      mockBusiness.mockResolvedValue({
        id: 'biz-1',
        userId: 'user-1',
        name: 'Test Biz',
      });
      mockPostScheduleFindMany.mockResolvedValue([]);
      mockCompetitorPost.mockResolvedValue([]);
      mockViralTrend.mockResolvedValue([]);

      const suggestions = await generateContentSuggestions({
        userId: 'user-1',
        businessId: 'biz-1',
        count: 2,
      });

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });
});
