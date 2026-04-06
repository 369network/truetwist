import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getUserCredits,
  checkCredits,
  recordGeneration,
  getGenerationHistory,
  getMonthlySpend,
} from '../credit-service';
import { PLAN_CREDITS } from '../types';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUniqueOrThrow: vi.fn(),
    },
    aiGeneration: {
      groupBy: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('Credit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserCredits', () => {
    it('should return credits for free plan user', async () => {
      vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
        plan: 'free',
      } as any);

      vi.mocked(prisma.aiGeneration.groupBy).mockResolvedValue([
        { generationType: 'text', _count: { id: 3 } },
        { generationType: 'image', _count: { id: 1 } },
      ] as any);

      const credits = await getUserCredits('user-123');

      expect(credits.text.used).toBe(3);
      expect(credits.text.limit).toBe(PLAN_CREDITS.free.textGenerations);
      expect(credits.text.remaining).toBe(
        PLAN_CREDITS.free.textGenerations - 3
      );

      expect(credits.image.used).toBe(1);
      expect(credits.image.limit).toBe(PLAN_CREDITS.free.imageGenerations);

      expect(credits.video.used).toBe(0);
      expect(credits.video.limit).toBe(PLAN_CREDITS.free.videoGenerations);
    });

    it('should return unlimited for enterprise plan', async () => {
      vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
        plan: 'enterprise',
      } as any);

      vi.mocked(prisma.aiGeneration.groupBy).mockResolvedValue([] as any);

      const credits = await getUserCredits('user-456');

      expect(credits.text.limit).toBe(-1);
      expect(credits.text.remaining).toBe(-1);
      expect(credits.image.limit).toBe(-1);
      expect(credits.video.limit).toBe(-1);
    });
  });

  describe('checkCredits', () => {
    it('should allow when credits remain', async () => {
      vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
        plan: 'free',
      } as any);

      vi.mocked(prisma.aiGeneration.groupBy).mockResolvedValue([
        { generationType: 'text', _count: { id: 5 } },
      ] as any);

      const result = await checkCredits('user-123', 'text');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5); // 10 - 5
    });

    it('should deny when credits exhausted', async () => {
      vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
        plan: 'free',
      } as any);

      vi.mocked(prisma.aiGeneration.groupBy).mockResolvedValue([
        { generationType: 'text', _count: { id: 10 } },
      ] as any);

      const result = await checkCredits('user-123', 'text');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should always allow for enterprise', async () => {
      vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
        plan: 'enterprise',
      } as any);

      vi.mocked(prisma.aiGeneration.groupBy).mockResolvedValue([] as any);

      const result = await checkCredits('user-123', 'text');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1);
    });
  });

  describe('recordGeneration', () => {
    it('should create an AI generation record', async () => {
      vi.mocked(prisma.aiGeneration.create).mockResolvedValue({
        id: 'gen-789',
      } as any);

      const id = await recordGeneration({
        userId: 'user-123',
        type: 'text',
        prompt: 'Test prompt',
        model: 'gpt-4o',
        outputText: 'Generated text',
        costCents: 5,
        durationMs: 1200,
      });

      expect(id).toBe('gen-789');
      expect(prisma.aiGeneration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          generationType: 'text',
          prompt: 'Test prompt',
          modelUsed: 'gpt-4o',
          costCents: 5,
        }),
      });
    });
  });

  describe('getGenerationHistory', () => {
    it('should return paginated history', async () => {
      const mockRecords = [
        { id: 'gen-1', generationType: 'text', prompt: 'test' },
      ];

      vi.mocked(prisma.aiGeneration.findMany).mockResolvedValue(
        mockRecords as any
      );
      vi.mocked(prisma.aiGeneration.count).mockResolvedValue(1);

      const result = await getGenerationHistory('user-123', {
        limit: 20,
        offset: 0,
      });

      expect(result.records).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by type when specified', async () => {
      vi.mocked(prisma.aiGeneration.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.aiGeneration.count).mockResolvedValue(0);

      await getGenerationHistory('user-123', { type: 'image' });

      expect(prisma.aiGeneration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', generationType: 'image' },
        })
      );
    });
  });

  describe('getMonthlySpend', () => {
    it('should return total spend in cents', async () => {
      vi.mocked(prisma.aiGeneration.aggregate).mockResolvedValue({
        _sum: { costCents: 150 },
      } as any);

      const spend = await getMonthlySpend('user-123');
      expect(spend).toBe(150);
    });

    it('should return 0 when no spend', async () => {
      vi.mocked(prisma.aiGeneration.aggregate).mockResolvedValue({
        _sum: { costCents: null },
      } as any);

      const spend = await getMonthlySpend('user-123');
      expect(spend).toBe(0);
    });
  });
});
