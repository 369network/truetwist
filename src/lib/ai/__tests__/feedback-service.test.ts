import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordFeedback,
  getUserFeedbackStats,
  getGenerationScore,
} from '../feedback-service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contentFeedback: {
      create: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('feedback-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordFeedback', () => {
    it('should create a feedback record with positive signal weight for "used"', async () => {
      vi.mocked(prisma.contentFeedback.create).mockResolvedValue({} as any);

      await recordFeedback({
        userId: 'user-1',
        generationId: 'gen-1',
        action: 'used',
      });

      expect(prisma.contentFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          generationId: 'gen-1',
          action: 'used',
          signalWeight: 1.0,
        }),
      });
    });

    it('should assign negative signal weight for "discarded"', async () => {
      vi.mocked(prisma.contentFeedback.create).mockResolvedValue({} as any);

      await recordFeedback({
        userId: 'user-1',
        generationId: 'gen-1',
        action: 'discarded',
      });

      expect(prisma.contentFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          signalWeight: -0.5,
        }),
      });
    });

    it('should assign partial weight for "edited"', async () => {
      vi.mocked(prisma.contentFeedback.create).mockResolvedValue({} as any);

      await recordFeedback({
        userId: 'user-1',
        generationId: 'gen-1',
        action: 'edited',
        editDistance: 0.3,
      });

      expect(prisma.contentFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'edited',
          signalWeight: 0.5,
          editDistance: 0.3,
        }),
      });
    });

    it('should assign highest weight for "shared"', async () => {
      vi.mocked(prisma.contentFeedback.create).mockResolvedValue({} as any);

      await recordFeedback({
        userId: 'user-1',
        generationId: 'gen-1',
        action: 'shared',
      });

      expect(prisma.contentFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          signalWeight: 1.5,
        }),
      });
    });

    it('should pass platform and metadata through', async () => {
      vi.mocked(prisma.contentFeedback.create).mockResolvedValue({} as any);

      await recordFeedback({
        userId: 'user-1',
        generationId: 'gen-1',
        action: 'used',
        platform: 'instagram',
        metadata: { variant: 'A' },
      });

      expect(prisma.contentFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platform: 'instagram',
          metadata: { variant: 'A' },
        }),
      });
    });
  });

  describe('getUserFeedbackStats', () => {
    it('should return zeroed stats when no feedback exists', async () => {
      vi.mocked(prisma.contentFeedback.groupBy).mockResolvedValue([] as any);

      const stats = await getUserFeedbackStats('user-1');

      expect(stats.totalGenerations).toBe(0);
      expect(stats.usedAsIs).toBe(0);
      expect(stats.useRate).toBe(0);
      expect(stats.discardRate).toBe(0);
    });

    it('should compute correct rates from grouped feedback', async () => {
      vi.mocked(prisma.contentFeedback.groupBy).mockResolvedValue([
        { action: 'used', _count: { action: 10 } },
        { action: 'edited', _count: { action: 5 } },
        { action: 'discarded', _count: { action: 5 } },
      ] as any);

      const stats = await getUserFeedbackStats('user-1');

      expect(stats.totalGenerations).toBe(20);
      expect(stats.usedAsIs).toBe(10);
      expect(stats.edited).toBe(5);
      expect(stats.discarded).toBe(5);
      expect(stats.useRate).toBe(0.75); // (10 + 5) / 20
      expect(stats.editRate).toBeCloseTo(0.333, 2); // 5 / 15
      expect(stats.discardRate).toBe(0.25); // 5 / 20
    });
  });

  describe('getGenerationScore', () => {
    const now = new Date();

    it('should return 0 when no feedbacks exist', async () => {
      vi.mocked(prisma.contentFeedback.findMany).mockResolvedValue([]);

      const score = await getGenerationScore('gen-1');
      expect(score).toBe(0);
    });

    it('should compute recency-weighted average of signal weights', async () => {
      // All feedback at same time → acts like simple average
      vi.mocked(prisma.contentFeedback.findMany).mockResolvedValue([
        { signalWeight: 1.0, createdAt: now },
        { signalWeight: 0.5, createdAt: now },
        { signalWeight: -0.5, createdAt: now },
      ] as any);

      const score = await getGenerationScore('gen-1');
      expect(score).toBeCloseTo(0.333, 2);
    });

    it('should weight recent feedback more heavily', async () => {
      const recent = new Date();
      const old = new Date(recent.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      vi.mocked(prisma.contentFeedback.findMany).mockResolvedValue([
        { signalWeight: 1.0, createdAt: recent },  // positive, recent
        { signalWeight: -1.0, createdAt: old },     // negative, old
      ] as any);

      const score = await getGenerationScore('gen-1');
      // Recent positive should dominate over old negative
      expect(score).toBeGreaterThan(0);
    });

    it('should return positive score for all positive same-time feedback', async () => {
      vi.mocked(prisma.contentFeedback.findMany).mockResolvedValue([
        { signalWeight: 1.0, createdAt: now },
        { signalWeight: 1.5, createdAt: now },
      ] as any);

      const score = await getGenerationScore('gen-1');
      expect(score).toBe(1.25);
    });
  });
});
