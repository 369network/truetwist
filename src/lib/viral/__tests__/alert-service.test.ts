import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateAndCreateAlerts, getUserAlerts, markAlertsRead, generateTrendDigest } from '../alert-service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    trendAlertPreference: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    viralTrend: {
      findMany: vi.fn(),
    },
    trendAlert: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    hashtag: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('Alert Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('evaluateAndCreateAlerts', () => {
    it('should create alerts for matching trends', async () => {
      vi.mocked(prisma.trendAlertPreference.findMany).mockResolvedValue([
        {
          id: 'pref-1',
          userId: 'user-1',
          businessId: null,
          nicheKeywords: ['fitness', 'health'],
          platforms: ['youtube', 'instagram'],
          minViralScore: 30,
          alertTypes: ['niche_match', 'trend_emerging'],
          digestFrequency: 'daily',
          webhookUrl: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      vi.mocked(prisma.viralTrend.findMany).mockResolvedValue([
        {
          id: 'trend-1',
          title: 'Fitness Challenge 2026',
          platform: 'youtube',
          viralScore: 75,
          lifecycle: 'emerging',
          velocity: 500,
          category: 'Health',
        },
      ] as any);

      vi.mocked(prisma.trendAlert.findMany).mockResolvedValue([]); // no existing alerts

      const count = await evaluateAndCreateAlerts();

      expect(count).toBe(1);
      expect(prisma.trendAlert.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              userId: 'user-1',
              trendId: 'trend-1',
              alertType: 'niche_match',
            }),
          ]),
        })
      );
    });

    it('should not create duplicate alerts', async () => {
      vi.mocked(prisma.trendAlertPreference.findMany).mockResolvedValue([
        {
          id: 'pref-1',
          userId: 'user-1',
          nicheKeywords: ['fitness'],
          platforms: [],
          minViralScore: 30,
          alertTypes: ['niche_match'],
          digestFrequency: 'daily',
          webhookUrl: null,
          isActive: true,
        },
      ] as any);

      vi.mocked(prisma.viralTrend.findMany).mockResolvedValue([
        { id: 'trend-1', title: 'Fitness tips', viralScore: 50, lifecycle: 'rising', velocity: 100, platform: 'youtube', category: null },
      ] as any);

      vi.mocked(prisma.trendAlert.findMany).mockResolvedValue([
        { userId: 'user-1', trendId: 'trend-1' },
      ] as any);

      const count = await evaluateAndCreateAlerts();
      expect(count).toBe(0);
      expect(prisma.trendAlert.createMany).not.toHaveBeenCalled();
    });
  });

  describe('getUserAlerts', () => {
    it('should return paginated alerts', async () => {
      vi.mocked(prisma.trendAlert.findMany).mockResolvedValue([
        { id: 'alert-1', alertType: 'niche_match', title: 'Test' },
      ] as any);
      vi.mocked(prisma.trendAlert.count).mockResolvedValue(1);

      const result = await getUserAlerts('user-1', { limit: 10 });
      expect(result.alerts).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by unread only', async () => {
      vi.mocked(prisma.trendAlert.findMany).mockResolvedValue([]);
      vi.mocked(prisma.trendAlert.count).mockResolvedValue(0);

      await getUserAlerts('user-1', { unreadOnly: true });

      expect(prisma.trendAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ readAt: null }),
        })
      );
    });
  });

  describe('markAlertsRead', () => {
    it('should mark specified alerts as read', async () => {
      vi.mocked(prisma.trendAlert.updateMany).mockResolvedValue({ count: 2 } as any);

      const count = await markAlertsRead(['alert-1', 'alert-2']);
      expect(count).toBe(2);
    });
  });

  describe('generateTrendDigest', () => {
    it('should generate a daily digest', async () => {
      vi.mocked(prisma.trendAlertPreference.findFirst).mockResolvedValue({
        nicheKeywords: ['tech'],
        platforms: ['youtube'],
      } as any);

      vi.mocked(prisma.viralTrend.findMany).mockResolvedValue([
        { title: 'AI News', platform: 'youtube', viralScore: 80, lifecycle: 'peaking' },
      ] as any);

      vi.mocked(prisma.hashtag.findMany).mockResolvedValue([
        { tag: 'ai', trendDirection: 'rising', reach: 50000 },
      ] as any);

      const digest = await generateTrendDigest('user-1', 'daily');

      expect(digest.userId).toBe('user-1');
      expect(digest.period).toBe('daily');
      expect(digest.topTrends).toHaveLength(1);
      expect(digest.generatedAt).toBeInstanceOf(Date);
    });
  });
});
