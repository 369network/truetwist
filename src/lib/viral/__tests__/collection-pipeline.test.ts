import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCollectionPipeline } from '../collection-pipeline';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    trendCollectionJob: { update: vi.fn() },
    viralTrend: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    trendSnapshot: { create: vi.fn(), findMany: vi.fn() },
    hashtag: { upsert: vi.fn() },
    trendHashtag: { upsert: vi.fn() },
  },
}));

vi.mock('../collectors', () => ({
  collectTrends: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { collectTrends } from '../collectors';

describe('Collection Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run collection and update job status on success', async () => {
    vi.mocked(collectTrends).mockResolvedValue([
      {
        title: 'Test Trend',
        platform: 'youtube',
        source: 'youtube',
        category: 'Entertainment',
        description: 'A test trend',
        exampleUrls: ['https://youtube.com/watch?v=test'],
        engagementMetrics: { views: 100000 },
        velocity: 5000,
        sentiment: 0.5,
        region: 'US',
        rawPayload: {},
        hashtags: ['test', 'trending'],
      },
    ]);

    vi.mocked(prisma.viralTrend.upsert).mockResolvedValue({
      id: 'trend-1',
      lifecycle: 'emerging',
      peakedAt: null,
    } as any);

    vi.mocked(prisma.trendSnapshot.findMany).mockResolvedValue([]);
    vi.mocked(prisma.hashtag.upsert).mockResolvedValue({ id: 'hashtag-1' } as any);

    const result = await runCollectionPipeline('youtube', 'US', 'job-1');

    expect(result.trendsFound).toBe(1);
    expect(result.trendsUpdated).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Should mark job as running then completed
    expect(prisma.trendCollectionJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'running' }),
      })
    );
    expect(prisma.trendCollectionJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'completed' }),
      })
    );
  });

  it('should mark job as failed on collector error', async () => {
    vi.mocked(collectTrends).mockRejectedValue(new Error('API rate limited'));

    const result = await runCollectionPipeline('twitter', 'US', 'job-2');

    expect(result.errors).toContain('API rate limited');
    expect(prisma.trendCollectionJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', errorMessage: 'API rate limited' }),
      })
    );
  });

  it('should continue processing remaining trends if one fails', async () => {
    vi.mocked(collectTrends).mockResolvedValue([
      {
        title: 'Good Trend',
        platform: 'youtube',
        source: 'youtube',
        category: null,
        description: null,
        exampleUrls: [],
        engagementMetrics: { views: 1000 },
        velocity: 100,
        sentiment: 0,
        region: 'US',
        rawPayload: {},
        hashtags: [],
      },
      {
        title: 'Bad Trend',
        platform: 'youtube',
        source: 'youtube',
        category: null,
        description: null,
        exampleUrls: [],
        engagementMetrics: { views: 500 },
        velocity: 50,
        sentiment: 0,
        region: 'US',
        rawPayload: {},
        hashtags: [],
      },
    ]);

    // First upsert succeeds, second fails
    vi.mocked(prisma.viralTrend.upsert)
      .mockResolvedValueOnce({ id: 'trend-1', lifecycle: 'emerging', peakedAt: null } as any)
      .mockRejectedValueOnce(new Error('DB constraint violation'));

    vi.mocked(prisma.trendSnapshot.findMany).mockResolvedValue([]);

    const result = await runCollectionPipeline('youtube', 'US', 'job-3');

    expect(result.trendsFound).toBe(2);
    expect(result.trendsUpdated).toBe(1);
    expect(result.errors).toHaveLength(1);
  });
});
