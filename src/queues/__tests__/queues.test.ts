import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAdd, mockGetJob, mockRemove } = vi.hoisted(() => ({
  mockAdd: vi.fn().mockResolvedValue({ id: 'mock-job-1' }),
  mockGetJob: vi.fn(),
  mockRemove: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockAdd,
    getJob: mockGetJob,
    getWaitingCount: vi.fn().mockResolvedValue(5),
    getActiveCount: vi.fn().mockResolvedValue(2),
    getDelayedCount: vi.fn().mockResolvedValue(10),
    getFailedCount: vi.fn().mockResolvedValue(1),
    getCompletedCount: vi.fn().mockResolvedValue(100),
  })),
  Worker: vi.fn(),
  FlowProducer: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  redis: {},
}));

import {
  addPostingJob,
  addAnalyticsJob,
  addToDeadLetter,
  cancelPostingJob,
  getQueueStats,
  postingQueue,
} from '@/queues';

describe('Queue System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addPostingJob', () => {
    it('should add a job with deterministic ID', async () => {
      const data = {
        postScheduleId: 'sched-1',
        postId: 'post-1',
        socialAccountId: 'acct-1',
        platform: 'instagram',
      };

      await addPostingJob(data, 5000);

      expect(mockAdd).toHaveBeenCalledWith(
        'post',
        data,
        expect.objectContaining({
          delay: 5000,
          jobId: 'post-sched-1',
        })
      );
    });

    it('should add job without delay when not specified', async () => {
      const data = {
        postScheduleId: 'sched-2',
        postId: 'post-2',
        socialAccountId: 'acct-1',
        platform: 'twitter',
      };

      await addPostingJob(data);

      expect(mockAdd).toHaveBeenCalledWith(
        'post',
        data,
        expect.objectContaining({
          jobId: 'post-sched-2',
        })
      );
    });
  });

  describe('cancelPostingJob', () => {
    it('should remove a delayed job', async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue('delayed'),
        remove: mockRemove,
      });

      const result = await cancelPostingJob('sched-1');
      expect(result).toBe(true);
      expect(mockRemove).toHaveBeenCalled();
    });

    it('should remove a waiting job', async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue('waiting'),
        remove: mockRemove,
      });

      const result = await cancelPostingJob('sched-1');
      expect(result).toBe(true);
    });

    it('should not remove an active job', async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue('active'),
        remove: mockRemove,
      });

      const result = await cancelPostingJob('sched-1');
      expect(result).toBe(false);
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('should return false if job not found', async () => {
      mockGetJob.mockResolvedValue(null);

      const result = await cancelPostingJob('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('addToDeadLetter', () => {
    it('should add a job to the dead letter queue without auto-removal', async () => {
      await addToDeadLetter({
        originalQueue: 'posting-queue',
        originalJobId: 'job-1',
        originalData: { platform: 'instagram' },
        failedAt: '2026-04-05T12:00:00Z',
        errorMessage: 'API timeout',
        attempts: 4,
      });

      expect(mockAdd).toHaveBeenCalledWith(
        'dead-letter',
        expect.objectContaining({
          originalQueue: 'posting-queue',
          errorMessage: 'API timeout',
        }),
        expect.objectContaining({
          removeOnComplete: false,
          removeOnFail: false,
        })
      );
    });
  });

  describe('addAnalyticsJob', () => {
    it('should default to 5 minute delay', async () => {
      await addAnalyticsJob({
        postScheduleId: 'sched-1',
        platform: 'instagram',
        platformPostId: 'insta-123',
      });

      expect(mockAdd).toHaveBeenCalledWith(
        'fetch-analytics',
        expect.anything(),
        expect.objectContaining({
          delay: 5 * 60 * 1000,
        })
      );
    });

    it('should accept custom delay', async () => {
      await addAnalyticsJob({
        postScheduleId: 'sched-1',
        platform: 'twitter',
        platformPostId: 'tw-456',
      }, 60000);

      expect(mockAdd).toHaveBeenCalledWith(
        'fetch-analytics',
        expect.anything(),
        expect.objectContaining({
          delay: 60000,
        })
      );
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const stats = await getQueueStats(postingQueue);
      expect(stats).toEqual({
        waiting: 5,
        active: 2,
        delayed: 10,
        failed: 1,
        completed: 100,
      });
    });
  });
});
