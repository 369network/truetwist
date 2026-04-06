import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma before importing the service
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contentFeedback: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { recordFeedback, getGenerationScore, getUserFeedbackProfile } from '../feedback-service';
import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  contentFeedback: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe('Feedback Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordFeedback', () => {
    it('creates a feedback record', async () => {
      mockPrisma.contentFeedback.create.mockResolvedValue({ id: 'fb-1' });

      await recordFeedback({
        userId: 'user-1',
        generationId: 'gen-1',
        action: 'used',
      });

      expect(mockPrisma.contentFeedback.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          generationId: 'gen-1',
          action: 'used',
          metadata: {},
        },
      });
    });

    it('passes metadata when provided', async () => {
      mockPrisma.contentFeedback.create.mockResolvedValue({ id: 'fb-2' });

      await recordFeedback({
        userId: 'user-1',
        generationId: 'gen-1',
        action: 'edited',
        metadata: { editDistance: 15 },
      });

      expect(mockPrisma.contentFeedback.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          generationId: 'gen-1',
          action: 'edited',
          metadata: { editDistance: 15 },
        },
      });
    });
  });

  describe('getGenerationScore', () => {
    it('returns zero score for no feedback', async () => {
      mockPrisma.contentFeedback.findMany.mockResolvedValue([]);

      const result = await getGenerationScore('gen-1');
      expect(result.score).toBe(0);
      expect(result.totalFeedback).toBe(0);
    });

    it('returns positive score for used feedback', async () => {
      mockPrisma.contentFeedback.findMany.mockResolvedValue([
        { action: 'used', createdAt: new Date() },
      ]);

      const result = await getGenerationScore('gen-1');
      expect(result.score).toBeGreaterThan(0);
      expect(result.totalFeedback).toBe(1);
    });

    it('returns negative score for discarded feedback', async () => {
      mockPrisma.contentFeedback.findMany.mockResolvedValue([
        { action: 'discarded', createdAt: new Date() },
      ]);

      const result = await getGenerationScore('gen-1');
      expect(result.score).toBeLessThan(0);
    });

    it('weighs recent feedback more than old feedback', async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Scenario: old positive, recent negative
      mockPrisma.contentFeedback.findMany.mockResolvedValue([
        { action: 'used', createdAt: thirtyDaysAgo },
        { action: 'discarded', createdAt: now },
      ]);

      const result = await getGenerationScore('gen-1');
      // Recent negative should dominate
      expect(result.score).toBeLessThan(0.5);
      expect(result.recentBias).toBeGreaterThan(0);
    });

    it('clamps score between -1 and 1', async () => {
      mockPrisma.contentFeedback.findMany.mockResolvedValue([
        { action: 'used', createdAt: new Date() },
        { action: 'shared', createdAt: new Date() },
        { action: 'favorited', createdAt: new Date() },
      ]);

      const result = await getGenerationScore('gen-1');
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.score).toBeGreaterThanOrEqual(-1);
    });

    it('handles mixed positive/negative feedback', async () => {
      mockPrisma.contentFeedback.findMany.mockResolvedValue([
        { action: 'used', createdAt: new Date() },
        { action: 'discarded', createdAt: new Date() },
      ]);

      const result = await getGenerationScore('gen-1');
      // Should be between pure positive and pure negative
      expect(result.score).toBeGreaterThan(-1);
      expect(result.score).toBeLessThan(1);
    });
  });

  describe('getUserFeedbackProfile', () => {
    it('returns empty profile for no feedback', async () => {
      mockPrisma.contentFeedback.findMany.mockResolvedValue([]);

      const result = await getUserFeedbackProfile('user-1');
      expect(result.totalGenerations).toBe(0);
      expect(result.avgScore).toBe(0);
      expect(result.actionBreakdown).toEqual({});
    });

    it('computes action breakdown correctly', async () => {
      mockPrisma.contentFeedback.findMany.mockResolvedValue([
        { action: 'used', createdAt: new Date() },
        { action: 'used', createdAt: new Date() },
        { action: 'edited', createdAt: new Date() },
        { action: 'discarded', createdAt: new Date() },
      ]);

      const result = await getUserFeedbackProfile('user-1');
      expect(result.totalGenerations).toBe(4);
      expect(result.actionBreakdown.used).toBe(2);
      expect(result.actionBreakdown.edited).toBe(1);
      expect(result.actionBreakdown.discarded).toBe(1);
    });

    it('computes average score correctly', async () => {
      mockPrisma.contentFeedback.findMany.mockResolvedValue([
        { action: 'used', createdAt: new Date() },      // weight: 1.0
        { action: 'discarded', createdAt: new Date() },  // weight: -0.5
      ]);

      const result = await getUserFeedbackProfile('user-1');
      // avg = (1.0 + -0.5) / 2 = 0.25
      expect(result.avgScore).toBeCloseTo(0.25, 2);
    });
  });
});
