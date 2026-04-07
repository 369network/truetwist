import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostingService } from '@/lib/social/posting-service';
import type { PostJob, PostContent, Platform } from '@/lib/social/types';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// vi.hoisted ensures these are available when vi.mock factories execute (hoisted).
const {
  mockAdd, mockGetJob, mockClose,
  mockGetWaitingCount, mockGetActiveCount, mockGetDelayedCount,
  mockGetFailedCount, mockGetCompletedCount,
  mockWorkerOn, mockWorkerClose,
  mockValidateContent, mockPublish,
} = vi.hoisted(() => ({
  mockAdd: vi.fn().mockResolvedValue({ id: 'job-1' }),
  mockGetJob: vi.fn(),
  mockClose: vi.fn().mockResolvedValue(undefined),
  mockGetWaitingCount: vi.fn().mockResolvedValue(5),
  mockGetActiveCount: vi.fn().mockResolvedValue(2),
  mockGetDelayedCount: vi.fn().mockResolvedValue(3),
  mockGetFailedCount: vi.fn().mockResolvedValue(1),
  mockGetCompletedCount: vi.fn().mockResolvedValue(100),
  mockWorkerOn: vi.fn(),
  mockWorkerClose: vi.fn().mockResolvedValue(undefined),
  mockValidateContent: vi.fn().mockReturnValue([]),
  mockPublish: vi.fn().mockResolvedValue({ success: true, platformPostId: 'post-123' }),
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockAdd,
    getJob: mockGetJob,
    close: mockClose,
    getWaitingCount: mockGetWaitingCount,
    getActiveCount: mockGetActiveCount,
    getDelayedCount: mockGetDelayedCount,
    getFailedCount: mockGetFailedCount,
    getCompletedCount: mockGetCompletedCount,
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: mockWorkerOn,
    close: mockWorkerClose,
  })),
  Job: vi.fn(),
}));

vi.mock('../platforms', () => ({
  getPlatformAdapter: vi.fn().mockReturnValue({
    validateContent: mockValidateContent,
    publish: mockPublish,
  }),
}));

vi.mock('../rate-limit-manager', () => ({
  RateLimitManager: vi.fn().mockImplementation(() => ({
    canMakeRequest: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() }),
    recordRequest: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../oauth2-manager', () => ({
  oauth2Manager: {
    needsRefresh: vi.fn().mockReturnValue(false),
    refreshTokens: vi.fn(),
    decryptAccessToken: vi.fn().mockReturnValue('decrypted-token'),
  },
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ConstructorParameters<typeof PostingService>[0]> = {}) {
  return {
    redis: {} as never,
    getEncryptedToken: vi.fn().mockResolvedValue({
      encryptedAccessToken: 'enc-access',
      encryptedRefreshToken: null,
      expiresAt: null,
      platform: 'twitter' as Platform,
    }),
    updateStoredTokens: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makePostJob(overrides: Partial<PostJob> = {}): PostJob {
  const content: PostContent = { text: 'Hello world' };
  return {
    postPlatformId: 'pp-1',
    userId: 'user-1',
    socialAccountId: 'sa-1',
    platform: 'twitter',
    content,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostingService', () => {
  let service: PostingService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAdd.mockResolvedValue({ id: 'job-1' });
    mockGetJob.mockResolvedValue(null);
    mockValidateContent.mockReturnValue([]);
    service = new PostingService(makeConfig());
  });

  // -------------------------------------------------------------------------
  // constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('creates a BullMQ Queue on construction', async () => {
      const { Queue } = await import('bullmq');
      expect(Queue).toHaveBeenCalledOnce();
      expect(Queue).toHaveBeenCalledWith('post-publishing', expect.objectContaining({
        defaultJobOptions: expect.any(Object),
      }));
    });

    it('creates a RateLimitManager on construction', async () => {
      const { RateLimitManager } = await import('../rate-limit-manager');
      expect(RateLimitManager).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // schedulePost
  // -------------------------------------------------------------------------

  describe('schedulePost', () => {
    it('validates content before adding the job to the queue', async () => {
      await service.schedulePost(makePostJob());
      expect(mockValidateContent).toHaveBeenCalledWith(makePostJob().content);
    });

    it('throws when validateContent returns errors', async () => {
      mockValidateContent.mockReturnValueOnce(['Text too long', 'Too many hashtags']);
      await expect(service.schedulePost(makePostJob())).rejects.toThrow(
        'Content validation failed: Text too long; Too many hashtags'
      );
    });

    it('adds a job to the queue and returns the job ID', async () => {
      mockAdd.mockResolvedValueOnce({ id: 'job-42' });
      const jobId = await service.schedulePost(makePostJob());
      expect(mockAdd).toHaveBeenCalledOnce();
      expect(jobId).toBe('job-42');
    });

    it('adds the job with no delay when no schedule is provided', async () => {
      await service.schedulePost(makePostJob());
      const [, , options] = mockAdd.mock.calls[0];
      expect(options).not.toHaveProperty('delay');
    });

    it('adds a delay when schedule.scheduledFor is in the future', async () => {
      const futureDate = new Date(Date.now() + 60_000);
      const job = makePostJob({ schedule: { scheduledFor: futureDate, timezone: 'UTC' } });
      await service.schedulePost(job);
      const [, , options] = mockAdd.mock.calls[0];
      expect(options.delay).toBeGreaterThan(0);
      expect(options.delay).toBeLessThanOrEqual(60_000);
    });

    it('does not add a delay when schedule.scheduledFor is in the past', async () => {
      const pastDate = new Date(Date.now() - 5_000);
      const job = makePostJob({ schedule: { scheduledFor: pastDate, timezone: 'UTC' } });
      await service.schedulePost(job);
      const [, , options] = mockAdd.mock.calls[0];
      expect(options).not.toHaveProperty('delay');
    });

    it('sets priority: 1 when schedule.isPriority is true', async () => {
      const futureDate = new Date(Date.now() + 10_000);
      const job = makePostJob({ schedule: { scheduledFor: futureDate, timezone: 'UTC', isPriority: true } });
      await service.schedulePost(job);
      const [, , options] = mockAdd.mock.calls[0];
      expect(options.priority).toBe(1);
    });

    it('does not set priority when schedule.isPriority is false', async () => {
      const futureDate = new Date(Date.now() + 10_000);
      const job = makePostJob({ schedule: { scheduledFor: futureDate, timezone: 'UTC', isPriority: false } });
      await service.schedulePost(job);
      const [, , options] = mockAdd.mock.calls[0];
      expect(options).not.toHaveProperty('priority');
    });
  });

  // -------------------------------------------------------------------------
  // cancelPost
  // -------------------------------------------------------------------------

  describe('cancelPost', () => {
    it('returns false when the job does not exist', async () => {
      mockGetJob.mockResolvedValueOnce(null);
      const result = await service.cancelPost('non-existent');
      expect(result).toBe(false);
    });

    it('removes a delayed job and returns true', async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      mockGetJob.mockResolvedValueOnce({
        getState: vi.fn().mockResolvedValue('delayed'),
        remove: mockRemove,
      });
      const result = await service.cancelPost('job-delayed');
      expect(mockRemove).toHaveBeenCalledOnce();
      expect(result).toBe(true);
    });

    it('removes a waiting job and returns true', async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      mockGetJob.mockResolvedValueOnce({
        getState: vi.fn().mockResolvedValue('waiting'),
        remove: mockRemove,
      });
      const result = await service.cancelPost('job-waiting');
      expect(mockRemove).toHaveBeenCalledOnce();
      expect(result).toBe(true);
    });

    it('returns false for an active job without removing it', async () => {
      const mockRemove = vi.fn();
      mockGetJob.mockResolvedValueOnce({
        getState: vi.fn().mockResolvedValue('active'),
        remove: mockRemove,
      });
      const result = await service.cancelPost('job-active');
      expect(mockRemove).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getQueueStats
  // -------------------------------------------------------------------------

  describe('getQueueStats', () => {
    it('returns the correct counts from all queue count methods', async () => {
      const stats = await service.getQueueStats();
      expect(stats).toEqual({
        waiting: 5,
        active: 2,
        delayed: 3,
        failed: 1,
        completed: 100,
      });
    });

    it('queries all five count methods', async () => {
      await service.getQueueStats();
      expect(mockGetWaitingCount).toHaveBeenCalledOnce();
      expect(mockGetActiveCount).toHaveBeenCalledOnce();
      expect(mockGetDelayedCount).toHaveBeenCalledOnce();
      expect(mockGetFailedCount).toHaveBeenCalledOnce();
      expect(mockGetCompletedCount).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // startWorker
  // -------------------------------------------------------------------------

  describe('startWorker', () => {
    it('creates a Worker when called for the first time', async () => {
      const { Worker } = await import('bullmq');
      service.startWorker();
      expect(Worker).toHaveBeenCalledOnce();
      expect(Worker).toHaveBeenCalledWith('post-publishing', expect.any(Function), expect.any(Object));
    });

    it('registers completed and failed event listeners', async () => {
      service.startWorker();
      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('calling startWorker a second time is idempotent (no second Worker created)', async () => {
      const { Worker } = await import('bullmq');
      service.startWorker();
      service.startWorker();
      expect(Worker).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // shutdown
  // -------------------------------------------------------------------------

  describe('shutdown', () => {
    it('closes the queue on shutdown', async () => {
      await service.shutdown();
      expect(mockClose).toHaveBeenCalledOnce();
    });

    it('closes the worker before the queue when one is running', async () => {
      service.startWorker();
      const callOrder: string[] = [];
      mockWorkerClose.mockImplementationOnce(async () => { callOrder.push('worker'); });
      mockClose.mockImplementationOnce(async () => { callOrder.push('queue'); });
      await service.shutdown();
      expect(mockWorkerClose).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['worker', 'queue']);
    });

    it('shuts down cleanly when no worker has been started', async () => {
      await expect(service.shutdown()).resolves.toBeUndefined();
      expect(mockWorkerClose).not.toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalledOnce();
    });
  });
});
