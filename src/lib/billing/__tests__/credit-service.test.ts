import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    creditBalance: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    creditTransaction: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn({
      creditBalance: {
        findUnique: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      creditTransaction: {
        create: vi.fn(),
      },
    })),
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    prices: { list: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
}));

vi.mock('./subscription-service', () => ({
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue('cus_test123'),
}));

import { prisma } from '@/lib/prisma';
import {
  getCreditBalance,
  consumeCredits,
  allocateMonthlyCredits,
  getCreditTransactions,
} from '../credit-service';

describe('CreditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCreditBalance', () => {
    it('should return zero balance when no record exists', async () => {
      vi.mocked(prisma.creditBalance.findUnique).mockResolvedValue(null);

      const result = await getCreditBalance('user-1');

      expect(result.balance).toBe(0);
      expect(result.monthlyAllocation).toBe(0);
      expect(result.warningThreshold).toBe(false);
    });

    it('should return balance with warning when >= 80% used', async () => {
      vi.mocked(prisma.creditBalance.findUnique).mockResolvedValue({
        id: 'cb-1',
        userId: 'user-1',
        balance: 10,
        monthlyAllocation: 100,
        topUpCredits: 0,
        periodStart: new Date('2026-04-01'),
        periodEnd: new Date('2026-04-30'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await getCreditBalance('user-1');

      expect(result.balance).toBe(10);
      expect(result.used).toBe(90);
      expect(result.warningThreshold).toBe(true);
    });

    it('should not warn when usage is below 80%', async () => {
      vi.mocked(prisma.creditBalance.findUnique).mockResolvedValue({
        id: 'cb-1',
        userId: 'user-1',
        balance: 60,
        monthlyAllocation: 100,
        topUpCredits: 0,
        periodStart: new Date('2026-04-01'),
        periodEnd: new Date('2026-04-30'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await getCreditBalance('user-1');

      expect(result.balance).toBe(60);
      expect(result.used).toBe(40);
      expect(result.warningThreshold).toBe(false);
    });
  });

  describe('consumeCredits', () => {
    it('should reject when balance is insufficient', async () => {
      const mockTx = {
        creditBalance: {
          findUnique: vi.fn().mockResolvedValue({ balance: 3 }),
          update: vi.fn(),
        },
        creditTransaction: { create: vi.fn() },
      };
      vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx));

      const result = await consumeCredits('user-1', 'image', 'Generate image');

      expect(result.allowed).toBe(false);
      expect(result.cost).toBe(5);
      expect(mockTx.creditBalance.update).not.toHaveBeenCalled();
    });

    it('should deduct credits for text generation (cost=1)', async () => {
      const mockTx = {
        creditBalance: {
          findUnique: vi.fn().mockResolvedValue({ balance: 50 }),
          update: vi.fn().mockResolvedValue({ balance: 49 }),
        },
        creditTransaction: { create: vi.fn() },
      };
      vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx));

      const result = await consumeCredits('user-1', 'text', 'Generate caption');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(49);
      expect(result.cost).toBe(1);
    });

    it('should deduct 20 credits for video generation', async () => {
      const mockTx = {
        creditBalance: {
          findUnique: vi.fn().mockResolvedValue({ balance: 50 }),
          update: vi.fn().mockResolvedValue({ balance: 30 }),
        },
        creditTransaction: { create: vi.fn() },
      };
      vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx));

      const result = await consumeCredits('user-1', 'video', 'Generate video');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(30);
      expect(result.cost).toBe(20);
    });

    it('should reject when balance is zero', async () => {
      const mockTx = {
        creditBalance: {
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
        creditTransaction: { create: vi.fn() },
      };
      vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx));

      const result = await consumeCredits('user-1', 'text', 'Generate text');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('allocateMonthlyCredits', () => {
    it('should allocate 500 credits for pro plan', async () => {
      const mockTx = {
        creditBalance: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn(),
        },
        creditTransaction: { create: vi.fn() },
      };
      vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx));

      await allocateMonthlyCredits('user-1', 'pro');

      expect(mockTx.creditBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            balance: 500,
            monthlyAllocation: 500,
          }),
        })
      );
    });

    it('should not allocate credits for free plan', async () => {
      const mockTx = {
        creditBalance: { findUnique: vi.fn(), upsert: vi.fn() },
        creditTransaction: { create: vi.fn() },
      };
      vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx));

      await allocateMonthlyCredits('user-1', 'free');

      expect(mockTx.creditBalance.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getCreditTransactions', () => {
    it('should return paginated transactions', async () => {
      vi.mocked(prisma.creditTransaction.findMany).mockResolvedValue([
        { id: 'tx-1', amount: -1, type: 'consumption' } as any,
      ]);
      vi.mocked(prisma.creditTransaction.count).mockResolvedValue(5);

      const result = await getCreditTransactions('user-1', { limit: 10, offset: 0 });

      expect(result.transactions).toHaveLength(1);
      expect(result.total).toBe(5);
    });
  });
});
