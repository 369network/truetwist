import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AbTestService } from '../ab-test-service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    abTest: {
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
    },
    abTestVariant: {
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('AbTestService', () => {
  let service: AbTestService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AbTestService();
  });

  describe('createTest', () => {
    it('should create an A/B test with variants', async () => {
      vi.mocked(prisma.abTest.create).mockResolvedValue({ id: 'test-1' } as any);

      const id = await service.createTest({
        userId: 'user-1',
        businessId: 'biz-1',
        name: 'Test headlines',
        variants: [
          { label: 'A', postId: 'post-1', platform: 'instagram' },
          { label: 'B', postId: 'post-2', platform: 'instagram' },
        ],
      });

      expect(id).toBe('test-1');
      expect(prisma.abTest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          businessId: 'biz-1',
          name: 'Test headlines',
          targetMetric: 'engagement_rate',
          minSampleSize: 100,
          variants: {
            create: [
              { label: 'A', postId: 'post-1', platform: 'instagram', socialAccountId: undefined },
              { label: 'B', postId: 'post-2', platform: 'instagram', socialAccountId: undefined },
            ],
          },
        }),
      });
    });
  });

  describe('startTest', () => {
    it('should set status to running and set startAt', async () => {
      vi.mocked(prisma.abTest.update).mockResolvedValue({} as any);

      await service.startTest('test-1', 'user-1');

      expect(prisma.abTest.update).toHaveBeenCalledWith({
        where: { id: 'test-1', userId: 'user-1' },
        data: { status: 'running', startAt: expect.any(Date) },
      });
    });
  });

  describe('updateVariantMetrics', () => {
    it('should update variant metrics and calculate engagement rate', async () => {
      vi.mocked(prisma.abTestVariant.update).mockResolvedValue({} as any);

      await service.updateVariantMetrics('var-1', {
        impressions: 1000,
        reach: 800,
        engagements: 50,
        likes: 30,
        comments: 10,
        shares: 5,
        clicks: 5,
      });

      expect(prisma.abTestVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: {
          impressions: 1000,
          reach: 800,
          engagements: 50,
          likes: 30,
          comments: 10,
          shares: 5,
          clicks: 5,
          engagementRate: 5, // (50/1000)*100
        },
      });
    });

    it('should set engagement rate to 0 when no impressions', async () => {
      vi.mocked(prisma.abTestVariant.update).mockResolvedValue({} as any);

      await service.updateVariantMetrics('var-1', {
        impressions: 0,
        reach: 0,
        engagements: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
      });

      expect(prisma.abTestVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: expect.objectContaining({ engagementRate: 0 }),
      });
    });
  });

  describe('checkSignificance', () => {
    it('should return not significant when sample size is too small', async () => {
      vi.mocked(prisma.abTest.findUniqueOrThrow).mockResolvedValue({
        id: 'test-1',
        targetMetric: 'engagement_rate',
        minSampleSize: 100,
        variants: [
          { id: 'a', label: 'A', impressions: 20, reach: 15, engagements: 5, clicks: 2, engagementRate: 25 },
          { id: 'b', label: 'B', impressions: 20, reach: 18, engagements: 3, clicks: 1, engagementRate: 15 },
        ],
      } as any);

      const result = await service.checkSignificance('test-1');

      expect(result.significant).toBe(false);
      expect(result.reason).toContain('Insufficient sample size');
    });

    it('should return not significant when less than 2 variants', async () => {
      vi.mocked(prisma.abTest.findUniqueOrThrow).mockResolvedValue({
        id: 'test-1',
        targetMetric: 'engagement_rate',
        minSampleSize: 100,
        variants: [
          { id: 'a', label: 'A', impressions: 500, reach: 400, engagements: 50, clicks: 10, engagementRate: 10 },
        ],
      } as any);

      const result = await service.checkSignificance('test-1');

      expect(result.significant).toBe(false);
      expect(result.reason).toContain('Need at least 2 variants');
    });

    it('should detect significant winner with large sample', async () => {
      vi.mocked(prisma.abTest.findUniqueOrThrow).mockResolvedValue({
        id: 'test-1',
        targetMetric: 'engagement_rate',
        minSampleSize: 100,
        variants: [
          { id: 'a', label: 'A', impressions: 5000, reach: 4000, engagements: 500, clicks: 100, engagementRate: 10 },
          { id: 'b', label: 'B', impressions: 5000, reach: 4000, engagements: 200, clicks: 50, engagementRate: 4 },
        ],
      } as any);

      const result = await service.checkSignificance('test-1');

      expect(result.significant).toBe(true);
      expect(result.winnerId).toBe('a');
      expect(result.winnerLabel).toBe('A');
      expect(result.confidence).toBeGreaterThanOrEqual(95);
    });
  });

  describe('cancelTest', () => {
    it('should set status to cancelled', async () => {
      vi.mocked(prisma.abTest.update).mockResolvedValue({} as any);

      await service.cancelTest('test-1', 'user-1');

      expect(prisma.abTest.update).toHaveBeenCalledWith({
        where: { id: 'test-1', userId: 'user-1' },
        data: { status: 'cancelled', endAt: expect.any(Date) },
      });
    });
  });

  describe('checkBayesianSignificance', () => {
    it('should return ~0.5 probability when variants are identical', async () => {
      vi.mocked(prisma.abTest.findUniqueOrThrow).mockResolvedValue({
        id: 'test-1',
        targetMetric: 'engagement_rate',
        minSampleSize: 100,
        variants: [
          { id: 'a', label: 'A', impressions: 1000, reach: 800, engagements: 100, clicks: 50, engagementRate: 10 },
          { id: 'b', label: 'B', impressions: 1000, reach: 800, engagements: 100, clicks: 50, engagementRate: 10 },
        ],
      } as any);

      const result = await service.checkBayesianSignificance('test-1');

      // With equal variants, P(B wins) should be ~0.5 (±0.05 tolerance for MC variance)
      expect(result.probabilityBWins).toBeGreaterThan(0.4);
      expect(result.probabilityBWins).toBeLessThan(0.6);
      expect(result.sufficient).toBe(false);
    });

    it('should detect clear winner with large effect size', async () => {
      vi.mocked(prisma.abTest.findUniqueOrThrow).mockResolvedValue({
        id: 'test-1',
        targetMetric: 'engagement_rate',
        minSampleSize: 100,
        variants: [
          { id: 'a', label: 'A', impressions: 5000, reach: 4000, engagements: 200, clicks: 50, engagementRate: 4 },
          { id: 'b', label: 'B', impressions: 5000, reach: 4000, engagements: 500, clicks: 100, engagementRate: 10 },
        ],
      } as any);

      const result = await service.checkBayesianSignificance('test-1');

      expect(result.probabilityBWins).toBeGreaterThan(0.95);
      expect(result.sufficient).toBe(true);
      expect(result.expectedLiftPercent).toBeGreaterThan(0);
      expect(result.reason).toContain('wins');
    });

    it('should return insufficient for few observations', async () => {
      vi.mocked(prisma.abTest.findUniqueOrThrow).mockResolvedValue({
        id: 'test-1',
        targetMetric: 'engagement_rate',
        minSampleSize: 100,
        variants: [
          { id: 'a', label: 'A', impressions: 10, reach: 8, engagements: 3, clicks: 1, engagementRate: 30 },
          { id: 'b', label: 'B', impressions: 10, reach: 8, engagements: 4, clicks: 2, engagementRate: 40 },
        ],
      } as any);

      const result = await service.checkBayesianSignificance('test-1');

      // Small sample — should not be sufficient
      expect(result.sufficient).toBe(false);
    });

    it('should return credible interval as tuple', async () => {
      vi.mocked(prisma.abTest.findUniqueOrThrow).mockResolvedValue({
        id: 'test-1',
        targetMetric: 'engagement_rate',
        minSampleSize: 100,
        variants: [
          { id: 'a', label: 'A', impressions: 1000, reach: 800, engagements: 100, clicks: 50, engagementRate: 10 },
          { id: 'b', label: 'B', impressions: 1000, reach: 800, engagements: 150, clicks: 70, engagementRate: 15 },
        ],
      } as any);

      const result = await service.checkBayesianSignificance('test-1');

      expect(result.credibleInterval).toHaveLength(2);
      expect(result.credibleInterval[0]).toBeLessThan(result.credibleInterval[1]);
    });

    it('should handle single variant gracefully', async () => {
      vi.mocked(prisma.abTest.findUniqueOrThrow).mockResolvedValue({
        id: 'test-1',
        targetMetric: 'engagement_rate',
        minSampleSize: 100,
        variants: [
          { id: 'a', label: 'A', impressions: 500, reach: 400, engagements: 50, clicks: 10, engagementRate: 10 },
        ],
      } as any);

      const result = await service.checkBayesianSignificance('test-1');

      expect(result.probabilityBWins).toBe(0.5);
      expect(result.sufficient).toBe(false);
    });
  });

  describe('getTestHistory', () => {
    it('should return tests ordered by createdAt desc', async () => {
      vi.mocked(prisma.abTest.findMany).mockResolvedValue([
        { id: 'test-2', name: 'Test 2' },
        { id: 'test-1', name: 'Test 1' },
      ] as any);

      const tests = await service.getTestHistory('user-1', 10);

      expect(tests).toHaveLength(2);
      expect(prisma.abTest.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { variants: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });
  });
});
