import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the scheduler
vi.mock('@/lib/prisma', () => ({
  prisma: {
    optimalPostingTime: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    postSchedule: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { SmartScheduler } from '@/lib/scheduling/smart-scheduler';
import { prisma } from '@/lib/prisma';

const mockPrisma = vi.mocked(prisma);

describe('SmartScheduler', () => {
  let scheduler: SmartScheduler;

  beforeEach(() => {
    scheduler = new SmartScheduler();
    vi.clearAllMocks();
  });

  describe('getOptimalSlots', () => {
    it('should return default optimal times for new accounts with no data', async () => {
      mockPrisma.optimalPostingTime.findMany.mockResolvedValue([]);
      mockPrisma.postSchedule.findMany.mockResolvedValue([]);

      const slots = await scheduler.getOptimalSlots({
        userId: 'user-1',
        socialAccountId: 'account-1',
        platform: 'instagram',
        timezone: 'UTC',
        count: 3,
      });

      expect(slots.length).toBeLessThanOrEqual(3);
      expect(slots.length).toBeGreaterThan(0);
      slots.forEach((slot) => {
        expect(slot.isDefault).toBe(true);
        expect(slot.score).toBeGreaterThan(0);
        expect(slot.scheduledAt).toBeInstanceOf(Date);
        expect(slot.scheduledAt.getTime()).toBeGreaterThan(Date.now());
      });
    });

    it('should use data-driven times when enough historical data exists', async () => {
      // Return 10 stored optimal times (>= 5 threshold)
      const storedTimes = Array.from({ length: 10 }, (_, i) => ({
        id: `opt-${i}`,
        socialAccountId: 'account-1',
        platform: 'instagram',
        dayOfWeek: i % 7,
        hourUtc: 10 + i,
        score: 0.9 - i * 0.05,
        sampleSize: 20,
        updatedAt: new Date(),
      }));

      mockPrisma.optimalPostingTime.findMany.mockResolvedValue(storedTimes);
      mockPrisma.postSchedule.findMany.mockResolvedValue([]);

      const slots = await scheduler.getOptimalSlots({
        userId: 'user-1',
        socialAccountId: 'account-1',
        platform: 'instagram',
        timezone: 'UTC',
        count: 3,
      });

      expect(slots.length).toBeGreaterThan(0);
      slots.forEach((slot) => {
        expect(slot.isDefault).toBe(false);
      });
      // Should be sorted by score descending
      for (let i = 1; i < slots.length; i++) {
        expect(slots[i - 1].score).toBeGreaterThanOrEqual(slots[i].score);
      }
    });

    it('should filter out slots that conflict with existing schedules', async () => {
      mockPrisma.optimalPostingTime.findMany.mockResolvedValue([]);

      // Simulate many existing schedules to consume slots
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setUTCHours(11, 0, 0, 0);

      mockPrisma.postSchedule.findMany.mockResolvedValue([
        {
          id: 's-1',
          scheduledAt: tomorrow,
          status: 'scheduled',
          postId: 'p-1',
          socialAccountId: 'account-1',
          platform: 'instagram',
          platformPostId: null,
          platformPostUrl: null,
          postedAt: null,
          bullJobId: null,
          errorMessage: null,
          retryCount: 0,
          maxRetries: 3,
          nextRetryAt: null,
          crossPostGroup: null,
          recurringId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const slots = await scheduler.getOptimalSlots({
        userId: 'user-1',
        socialAccountId: 'account-1',
        platform: 'instagram',
        timezone: 'UTC',
        count: 5,
      });

      // None of the returned slots should be within 60 min of the existing schedule
      slots.forEach((slot) => {
        const diff = Math.abs(slot.scheduledAt.getTime() - tomorrow.getTime());
        expect(diff).toBeGreaterThanOrEqual(60 * 60 * 1000);
      });
    });
  });

  describe('validateSchedule', () => {
    it('should reject past times', async () => {
      const past = new Date(Date.now() - 60000);
      const result = await scheduler.validateSchedule('account-1', 'instagram', past);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('future');
    });

    it('should reject times too close to existing schedules', async () => {
      mockPrisma.postSchedule.count.mockResolvedValue(1);

      const future = new Date(Date.now() + 3600000);
      const result = await scheduler.validateSchedule('account-1', 'instagram', future);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('minutes');
    });

    it('should accept valid future times with no conflicts', async () => {
      mockPrisma.postSchedule.count.mockResolvedValue(0);

      const future = new Date(Date.now() + 3600000);
      const result = await scheduler.validateSchedule('account-1', 'instagram', future);
      expect(result.valid).toBe(true);
    });

    it('should reject when daily limit is reached', async () => {
      // First count call (interval check) returns 0, second (daily limit) returns 25
      mockPrisma.postSchedule.count
        .mockResolvedValueOnce(0) // no interval conflict
        .mockResolvedValueOnce(25); // daily limit reached for instagram

      const future = new Date(Date.now() + 3600000);
      const result = await scheduler.validateSchedule('account-1', 'instagram', future);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Daily limit');
    });
  });

  describe('toUserTime / toUtc', () => {
    it('should format UTC date to user timezone string', () => {
      const utcDate = new Date('2026-04-05T15:00:00Z');
      const result = scheduler.toUserTime(utcDate, 'America/New_York');
      expect(result).toBeTruthy();
      // Should contain the time in ET (11:00 AM EDT)
      expect(result).toContain('11');
    });
  });
});
