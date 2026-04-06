import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    postSchedule: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    socialAccount: {
      findFirst: vi.fn(),
    },
    optimalPostingTime: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/queues', () => ({
  addPostingJob: vi.fn().mockResolvedValue({ id: 'bull-job-1' }),
  addFanOutJobs: vi.fn().mockResolvedValue([]),
  addAnalyticsJob: vi.fn().mockResolvedValue({ id: 'analytics-job-1' }),
  cancelPostingJob: vi.fn().mockResolvedValue(true),
  reschedulePostingJob: vi.fn().mockResolvedValue('new-job-1'),
  addToDeadLetter: vi.fn().mockResolvedValue({ id: 'dl-job-1' }),
}));

import { PostLifecycleManager } from '@/lib/scheduling/post-lifecycle';
import { prisma } from '@/lib/prisma';
import * as queues from '@/queues';

const mockPrisma = vi.mocked(prisma);
const mockQueues = vi.mocked(queues);

describe('PostLifecycleManager', () => {
  let lifecycle: PostLifecycleManager;

  beforeEach(() => {
    lifecycle = new PostLifecycleManager();
    vi.clearAllMocks();
  });

  describe('transitionScheduleStatus', () => {
    it('should allow valid transitions (draft -> scheduled)', async () => {
      mockPrisma.postSchedule.findUniqueOrThrow.mockResolvedValue({
        id: 'sched-1',
        postId: 'post-1',
        socialAccountId: 'acct-1',
        platform: 'instagram',
        status: 'draft',
        scheduledAt: new Date(),
        postedAt: null,
        platformPostId: null,
        platformPostUrl: null,
        bullJobId: null,
        errorMessage: null,
        retryCount: 0,
        maxRetries: 3,
        nextRetryAt: null,
        crossPostGroup: null,
        recurringId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.postSchedule.update.mockResolvedValue({} as never);
      mockPrisma.postSchedule.findMany.mockResolvedValue([{ status: 'scheduled' }] as never);
      mockPrisma.post.update.mockResolvedValue({} as never);

      await expect(
        lifecycle.transitionScheduleStatus('sched-1', 'scheduled')
      ).resolves.not.toThrow();

      expect(mockPrisma.postSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sched-1' },
          data: expect.objectContaining({ status: 'scheduled' }),
        })
      );
    });

    it('should reject invalid transitions (draft -> posted)', async () => {
      mockPrisma.postSchedule.findUniqueOrThrow.mockResolvedValue({
        id: 'sched-1',
        postId: 'post-1',
        status: 'draft',
      } as never);

      await expect(
        lifecycle.transitionScheduleStatus('sched-1', 'posted')
      ).rejects.toThrow('Invalid transition');
    });

    it('should set postedAt on transition to posted', async () => {
      mockPrisma.postSchedule.findUniqueOrThrow.mockResolvedValue({
        id: 'sched-1',
        postId: 'post-1',
        status: 'posting',
      } as never);
      mockPrisma.postSchedule.update.mockResolvedValue({} as never);
      mockPrisma.postSchedule.findMany.mockResolvedValue([{ status: 'posted' }] as never);
      mockPrisma.post.update.mockResolvedValue({} as never);

      await lifecycle.transitionScheduleStatus('sched-1', 'posted', {
        platformPostId: 'insta-123',
        platformPostUrl: 'https://instagram.com/p/123',
      });

      expect(mockPrisma.postSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'posted',
            postedAt: expect.any(Date),
            platformPostId: 'insta-123',
            platformPostUrl: 'https://instagram.com/p/123',
          }),
        })
      );
    });
  });

  describe('syncPostStatus', () => {
    it('should set post to "posted" when all schedules are posted', async () => {
      mockPrisma.postSchedule.findMany.mockResolvedValue([
        { status: 'posted' },
        { status: 'posted' },
      ] as never);
      mockPrisma.post.update.mockResolvedValue({} as never);

      await lifecycle.syncPostStatus('post-1');

      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { status: 'posted' },
      });
    });

    it('should set post to "failed" when any schedule is failed', async () => {
      mockPrisma.postSchedule.findMany.mockResolvedValue([
        { status: 'posted' },
        { status: 'failed' },
      ] as never);
      mockPrisma.post.update.mockResolvedValue({} as never);

      await lifecycle.syncPostStatus('post-1');

      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { status: 'failed' },
      });
    });

    it('should set post to "posting" when any schedule is posting', async () => {
      mockPrisma.postSchedule.findMany.mockResolvedValue([
        { status: 'posting' },
        { status: 'scheduled' },
      ] as never);
      mockPrisma.post.update.mockResolvedValue({} as never);

      await lifecycle.syncPostStatus('post-1');

      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { status: 'posting' },
      });
    });
  });

  describe('cancelSchedule', () => {
    it('should cancel a scheduled post and update status', async () => {
      mockPrisma.postSchedule.findUniqueOrThrow.mockResolvedValue({
        id: 'sched-1',
        postId: 'post-1',
        status: 'scheduled',
        bullJobId: 'bull-job-1',
      } as never);
      mockPrisma.postSchedule.update.mockResolvedValue({} as never);
      mockPrisma.postSchedule.findMany.mockResolvedValue([{ status: 'cancelled' }] as never);
      mockPrisma.post.update.mockResolvedValue({} as never);

      await lifecycle.cancelSchedule('sched-1');

      expect(mockQueues.cancelPostingJob).toHaveBeenCalledWith('sched-1');
    });

    it('should reject cancelling a post that is currently posting', async () => {
      mockPrisma.postSchedule.findUniqueOrThrow.mockResolvedValue({
        id: 'sched-1',
        postId: 'post-1',
        status: 'posting',
        bullJobId: 'bull-job-1',
      } as never);

      await expect(lifecycle.cancelSchedule('sched-1')).rejects.toThrow(
        'Cannot cancel'
      );
    });
  });

  describe('onFailed', () => {
    it('should move to dead letter queue when max retries exceeded', async () => {
      mockPrisma.postSchedule.findUniqueOrThrow.mockResolvedValue({
        id: 'sched-1',
        postId: 'post-1',
        socialAccountId: 'acct-1',
        platform: 'instagram',
        status: 'posting',
        bullJobId: 'bull-1',
        maxRetries: 3,
        retryCount: 2,
      } as never);
      mockPrisma.postSchedule.update.mockResolvedValue({} as never);
      mockPrisma.postSchedule.findMany.mockResolvedValue([{ status: 'failed' }] as never);
      mockPrisma.post.update.mockResolvedValue({} as never);

      await lifecycle.onFailed('sched-1', 'API timeout', 3);

      expect(mockQueues.addToDeadLetter).toHaveBeenCalledWith(
        expect.objectContaining({
          originalQueue: 'posting-queue',
          errorMessage: 'API timeout',
          attempts: 3,
        })
      );
    });

    it('should not move to DLQ if retries remain', async () => {
      mockPrisma.postSchedule.findUniqueOrThrow.mockResolvedValue({
        id: 'sched-1',
        postId: 'post-1',
        socialAccountId: 'acct-1',
        platform: 'instagram',
        status: 'posting',
        bullJobId: 'bull-1',
        maxRetries: 3,
        retryCount: 0,
      } as never);
      mockPrisma.postSchedule.update.mockResolvedValue({} as never);
      mockPrisma.postSchedule.findMany.mockResolvedValue([{ status: 'failed' }] as never);
      mockPrisma.post.update.mockResolvedValue({} as never);

      await lifecycle.onFailed('sched-1', 'Temporary error', 1);

      expect(mockQueues.addToDeadLetter).not.toHaveBeenCalled();
    });
  });

  describe('onPublished', () => {
    it('should update status and queue analytics job', async () => {
      mockPrisma.postSchedule.findUniqueOrThrow
        .mockResolvedValueOnce({
          id: 'sched-1',
          postId: 'post-1',
          status: 'posting',
        } as never)
        .mockResolvedValueOnce({
          id: 'sched-1',
          postId: 'post-1',
          platform: 'instagram',
        } as never);
      mockPrisma.postSchedule.update.mockResolvedValue({} as never);
      mockPrisma.postSchedule.findMany.mockResolvedValue([{ status: 'posted' }] as never);
      mockPrisma.post.update.mockResolvedValue({} as never);

      await lifecycle.onPublished('sched-1', 'insta-post-123', 'https://instagram.com/p/123');

      expect(mockQueues.addAnalyticsJob).toHaveBeenCalledWith(
        expect.objectContaining({
          postScheduleId: 'sched-1',
          platformPostId: 'insta-post-123',
        })
      );
    });
  });
});
