import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportService } from '../export-service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    postSchedule: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExportService();
  });

  const mockSchedules = [
    {
      scheduledAt: new Date('2026-03-15T10:00:00Z'),
      post: { id: 'p1', contentText: 'Hello world', contentType: 'text' },
      socialAccount: { platform: 'instagram', accountName: 'myaccount' },
      analytics: [{
        impressions: 1000, reach: 800, likes: 50, comments: 10,
        shares: 5, saves: 3, clicks: 20, engagementRate: 6.8,
      }],
    },
    {
      scheduledAt: new Date('2026-03-16T14:00:00Z'),
      post: { id: 'p2', contentText: 'Another post', contentType: 'image' },
      socialAccount: { platform: 'twitter', accountName: 'mytwitter' },
      analytics: [{
        impressions: 500, reach: 400, likes: 30, comments: 5,
        shares: 10, saves: 0, clicks: 15, engagementRate: 9.0,
      }],
    },
  ];

  describe('exportAnalytics', () => {
    it('should export as CSV', async () => {
      vi.mocked(prisma.postSchedule.findMany).mockResolvedValue(mockSchedules as any);

      const result = await service.exportAnalytics({
        userId: 'user-1',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        format: 'csv',
      });

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toContain('.csv');
      expect(result.content).toContain('date,platform,account,content,contentType');
      expect(result.content).toContain('instagram');
      expect(result.content).toContain('twitter');
    });

    it('should export as JSON', async () => {
      vi.mocked(prisma.postSchedule.findMany).mockResolvedValue(mockSchedules as any);

      const result = await service.exportAnalytics({
        userId: 'user-1',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        format: 'json',
      });

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toContain('.json');

      const parsed = JSON.parse(result.content);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].platform).toBe('instagram');
      expect(parsed[0].impressions).toBe(1000);
    });

    it('should handle empty data', async () => {
      vi.mocked(prisma.postSchedule.findMany).mockResolvedValue([]);

      const result = await service.exportAnalytics({
        userId: 'user-1',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        format: 'csv',
      });

      expect(result.content).toBe('');
    });

    it('should handle posts with no analytics', async () => {
      vi.mocked(prisma.postSchedule.findMany).mockResolvedValue([
        {
          scheduledAt: new Date('2026-03-15T10:00:00Z'),
          post: { id: 'p1', contentText: 'No analytics', contentType: 'text' },
          socialAccount: { platform: 'instagram', accountName: 'myaccount' },
          analytics: [],
        },
      ] as any);

      const result = await service.exportAnalytics({
        userId: 'user-1',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        format: 'csv',
      });

      expect(result.content).toContain('0'); // default values
    });
  });
});
