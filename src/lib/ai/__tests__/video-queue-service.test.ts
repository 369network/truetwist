import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  queueVideoGeneration,
  processVideoJob,
  getVideoJob,
  listVideoJobs,
  cancelVideoJob,
} from '../video-queue-service';
import type { BrandContext, VideoAspectRatio } from '../types';
import type { QueueVideoRequest } from '../video-queue-service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    videoGenerationJob: {
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/queues', () => ({
  contentGenerationQueue: {
    add: vi.fn().mockResolvedValue({ id: 'bull-job-1' }),
    getJob: vi.fn(),
  },
}));

vi.mock('./runway-client', () => ({
  estimateCostCents: vi.fn().mockReturnValue(50),
  isConfigured: vi.fn().mockReturnValue(false),
  submitGeneration: vi.fn(),
  waitForCompletion: vi.fn(),
  RunwayApiError: class RunwayApiError extends Error {
    isRetryable = false;
    constructor(message: string, retryable = false) {
      super(message);
      this.name = 'RunwayApiError';
      this.isRetryable = retryable;
    }
  },
}));

vi.mock('./video-generation-service', () => ({
  generateVideo: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { contentGenerationQueue } from '@/queues';
import {
  estimateCostCents,
  isConfigured,
  submitGeneration,
  waitForCompletion,
  RunwayApiError,
} from './runway-client';
import { generateVideo } from './video-generation-service';

// -----------------------------------------------
// Shared fixtures
// -----------------------------------------------

const mockBrand: BrandContext = {
  businessName: 'TestBrand',
  industry: 'Retail',
  brandVoice: 'friendly',
};

const mockQueueRequest: QueueVideoRequest = {
  userId: 'user-abc',
  businessId: 'biz-xyz',
  prompt: 'Showcase new product line',
  platform: 'instagram',
  aspectRatio: '9:16' as VideoAspectRatio,
  durationSeconds: 10,
  brand: mockBrand,
};

const baseDbJob = {
  id: 'job-001',
  userId: 'user-abc',
  businessId: 'biz-xyz',
  prompt: 'Showcase new product line',
  platform: 'instagram',
  template: null,
  aspectRatio: '9:16',
  durationSeconds: 10,
  status: 'queued',
  outputVideoUrl: null,
  thumbnailUrl: null,
  sourceVideoUrl: null,
  costCents: 50,
  errorMessage: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  completedAt: null,
  startedAt: null,
  runwayTaskId: null,
  provider: 'fallback',
  batchGroup: null,
  parentJobId: null,
  metadata: {},
  retryCount: 0,
  maxRetries: 2,
};

// -----------------------------------------------
// Tests
// -----------------------------------------------

describe('Video Queue Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isConfigured).mockReturnValue(false);
    vi.mocked(estimateCostCents).mockReturnValue(50);
  });

  // -----------------------------------------------
  // queueVideoGeneration
  // -----------------------------------------------

  describe('queueVideoGeneration', () => {
    it('creates a DB record with correct fields', async () => {
      vi.mocked(prisma.videoGenerationJob.create).mockResolvedValue(
        baseDbJob as any
      );

      await queueVideoGeneration(mockQueueRequest);

      expect(prisma.videoGenerationJob.create).toHaveBeenCalledOnce();
      expect(prisma.videoGenerationJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-abc',
            businessId: 'biz-xyz',
            prompt: 'Showcase new product line',
            platform: 'instagram',
            aspectRatio: '9:16',
            durationSeconds: 10,
            costCents: 50,
            provider: 'fallback',
          }),
        })
      );
    });

    it('uses runway provider when Runway is configured', async () => {
      vi.mocked(isConfigured).mockReturnValue(true);
      vi.mocked(prisma.videoGenerationJob.create).mockResolvedValue({
        ...baseDbJob,
        provider: 'runway',
      } as any);

      await queueVideoGeneration(mockQueueRequest);

      expect(prisma.videoGenerationJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ provider: 'runway' }),
        })
      );
    });

    it('pushes a video-generate job to BullMQ with correct payload', async () => {
      vi.mocked(prisma.videoGenerationJob.create).mockResolvedValue(
        baseDbJob as any
      );

      await queueVideoGeneration(mockQueueRequest);

      expect(contentGenerationQueue.add).toHaveBeenCalledOnce();
      expect(contentGenerationQueue.add).toHaveBeenCalledWith(
        'video-generate',
        { videoJobId: 'job-001', brand: mockBrand },
        expect.objectContaining({
          attempts: 3,
          jobId: 'video-job-001',
        })
      );
    });

    it('returns a VideoJobSummary with correct shape', async () => {
      vi.mocked(prisma.videoGenerationJob.create).mockResolvedValue(
        baseDbJob as any
      );

      const summary = await queueVideoGeneration(mockQueueRequest);

      expect(summary).toEqual({
        id: 'job-001',
        status: 'queued',
        platform: 'instagram',
        aspectRatio: '9:16',
        durationSeconds: 10,
        outputVideoUrl: null,
        thumbnailUrl: null,
        costCents: 50,
        errorMessage: null,
        createdAt: baseDbJob.createdAt,
        completedAt: null,
      });
    });
  });

  // -----------------------------------------------
  // getVideoJob
  // -----------------------------------------------

  describe('getVideoJob', () => {
    it('returns a VideoJobSummary when the job exists for the user', async () => {
      vi.mocked(prisma.videoGenerationJob.findFirst).mockResolvedValue(
        baseDbJob as any
      );

      const result = await getVideoJob('job-001', 'user-abc');

      expect(prisma.videoGenerationJob.findFirst).toHaveBeenCalledWith({
        where: { id: 'job-001', userId: 'user-abc' },
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe('job-001');
      expect(result?.status).toBe('queued');
    });

    it('returns null when the job does not exist or belongs to another user', async () => {
      vi.mocked(prisma.videoGenerationJob.findFirst).mockResolvedValue(null);

      const result = await getVideoJob('job-999', 'user-abc');

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------
  // listVideoJobs
  // -----------------------------------------------

  describe('listVideoJobs', () => {
    it('returns all jobs for a user with default pagination', async () => {
      const mockJobs = [baseDbJob, { ...baseDbJob, id: 'job-002' }];
      vi.mocked(prisma.videoGenerationJob.findMany).mockResolvedValue(
        mockJobs as any
      );

      const results = await listVideoJobs('user-abc');

      expect(prisma.videoGenerationJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-abc' },
          orderBy: { createdAt: 'desc' },
          take: 20,
          skip: 0,
        })
      );
      expect(results).toHaveLength(2);
    });

    it('applies status and batchGroup filters when provided', async () => {
      vi.mocked(prisma.videoGenerationJob.findMany).mockResolvedValue([] as any);

      await listVideoJobs('user-abc', {
        status: 'ready',
        batchGroup: 'batch-A',
        limit: 5,
        offset: 10,
      });

      expect(prisma.videoGenerationJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-abc', status: 'ready', batchGroup: 'batch-A' },
          take: 5,
          skip: 10,
        })
      );
    });

    it('returns mapped VideoJobSummary objects for each job', async () => {
      const readyJob = {
        ...baseDbJob,
        id: 'job-003',
        status: 'ready',
        outputVideoUrl: 'https://cdn.example.com/video.mp4',
        completedAt: new Date('2026-01-02T00:00:00Z'),
      };
      vi.mocked(prisma.videoGenerationJob.findMany).mockResolvedValue(
        [readyJob] as any
      );

      const results = await listVideoJobs('user-abc');

      expect(results[0].id).toBe('job-003');
      expect(results[0].status).toBe('ready');
      expect(results[0].outputVideoUrl).toBe('https://cdn.example.com/video.mp4');
    });
  });

  // -----------------------------------------------
  // cancelVideoJob
  // -----------------------------------------------

  describe('cancelVideoJob', () => {
    it('cancels a queued job, marks it failed, and removes from BullMQ', async () => {
      vi.mocked(prisma.videoGenerationJob.findFirst).mockResolvedValue(
        baseDbJob as any
      );
      vi.mocked(prisma.videoGenerationJob.update).mockResolvedValue({
        ...baseDbJob,
        status: 'failed',
        errorMessage: 'Cancelled by user',
      } as any);

      const mockBullJob = {
        getState: vi.fn().mockResolvedValue('waiting'),
        remove: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(contentGenerationQueue.getJob).mockResolvedValue(
        mockBullJob as any
      );

      const result = await cancelVideoJob('job-001', 'user-abc');

      expect(result).toBe(true);
      expect(prisma.videoGenerationJob.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'job-001',
          userId: 'user-abc',
          status: { in: ['queued', 'generating'] },
        },
      });
      expect(prisma.videoGenerationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-001' },
          data: expect.objectContaining({
            status: 'failed',
            errorMessage: 'Cancelled by user',
          }),
        })
      );
      expect(mockBullJob.remove).toHaveBeenCalled();
    });

    it('returns false when no cancellable job is found', async () => {
      vi.mocked(prisma.videoGenerationJob.findFirst).mockResolvedValue(null);

      const result = await cancelVideoJob('job-999', 'user-abc');

      expect(result).toBe(false);
      expect(prisma.videoGenerationJob.update).not.toHaveBeenCalled();
    });

    it('does not remove BullMQ job when it is already active (not waiting/delayed)', async () => {
      vi.mocked(prisma.videoGenerationJob.findFirst).mockResolvedValue({
        ...baseDbJob,
        status: 'generating',
      } as any);
      vi.mocked(prisma.videoGenerationJob.update).mockResolvedValue({} as any);

      const mockBullJob = {
        getState: vi.fn().mockResolvedValue('active'),
        remove: vi.fn(),
      };
      vi.mocked(contentGenerationQueue.getJob).mockResolvedValue(
        mockBullJob as any
      );

      const result = await cancelVideoJob('job-001', 'user-abc');

      expect(result).toBe(true);
      expect(mockBullJob.remove).not.toHaveBeenCalled();
    });

    it('still succeeds when the BullMQ job no longer exists', async () => {
      vi.mocked(prisma.videoGenerationJob.findFirst).mockResolvedValue(
        baseDbJob as any
      );
      vi.mocked(prisma.videoGenerationJob.update).mockResolvedValue({} as any);
      vi.mocked(contentGenerationQueue.getJob).mockResolvedValue(null as any);

      const result = await cancelVideoJob('job-001', 'user-abc');

      expect(result).toBe(true);
    });
  });

  // -----------------------------------------------
  // processVideoJob
  // -----------------------------------------------

  describe('processVideoJob', () => {
    it('processes a job successfully using the fallback path', async () => {
      vi.mocked(isConfigured).mockReturnValue(false);
      vi.mocked(prisma.videoGenerationJob.update).mockResolvedValue({} as any);
      vi.mocked(prisma.videoGenerationJob.findUniqueOrThrow).mockResolvedValue(
        baseDbJob as any
      );
      vi.mocked(generateVideo).mockResolvedValue({
        video: {
          url: 'https://cdn.example.com/fallback.mp4',
          thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
          durationSeconds: 10,
          aspectRatio: '9:16',
        },
        model: 'gpt-4o+dall-e-3',
        costCents: 50,
        durationMs: 3000,
      });

      await processVideoJob('job-001', mockBrand);

      // First update: set status to 'generating'
      expect(prisma.videoGenerationJob.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: 'job-001' },
          data: expect.objectContaining({ status: 'generating' }),
        })
      );

      // generateVideo (fallback) should be called, not submitGeneration
      expect(generateVideo).toHaveBeenCalledOnce();
      expect(submitGeneration).not.toHaveBeenCalled();

      // Intermediate update: status 'processing'
      expect(prisma.videoGenerationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'processing',
            sourceVideoUrl: 'https://cdn.example.com/fallback.mp4',
            thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
          }),
        })
      );

      // Final update: status 'ready'
      expect(prisma.videoGenerationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ready',
            outputVideoUrl: 'https://cdn.example.com/fallback.mp4',
          }),
        })
      );
    });

    it('processes a job successfully using Runway', async () => {
      vi.mocked(isConfigured).mockReturnValue(true);
      vi.mocked(prisma.videoGenerationJob.update).mockResolvedValue({} as any);
      vi.mocked(prisma.videoGenerationJob.findUniqueOrThrow).mockResolvedValue(
        baseDbJob as any
      );
      vi.mocked(submitGeneration).mockResolvedValue({ taskId: 'task-runway-1' });
      vi.mocked(waitForCompletion).mockResolvedValue({
        status: 'SUCCEEDED',
        output: ['https://cdn.runway.com/output.mp4'],
      } as any);

      await processVideoJob('job-001', mockBrand);

      expect(submitGeneration).toHaveBeenCalledOnce();
      expect(waitForCompletion).toHaveBeenCalledWith('task-runway-1');
      expect(generateVideo).not.toHaveBeenCalled();

      // runwayTaskId should be stored after submitting
      expect(prisma.videoGenerationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ runwayTaskId: 'task-runway-1' }),
        })
      );

      // Final status should be 'ready' with the Runway output URL
      expect(prisma.videoGenerationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ready',
            outputVideoUrl: 'https://cdn.runway.com/output.mp4',
          }),
        })
      );
    });

    it('sets status to failed and stores error when Runway reports FAILED', async () => {
      vi.mocked(isConfigured).mockReturnValue(true);
      vi.mocked(prisma.videoGenerationJob.update).mockResolvedValue({} as any);
      vi.mocked(prisma.videoGenerationJob.findUniqueOrThrow).mockResolvedValue(
        baseDbJob as any
      );
      vi.mocked(prisma.videoGenerationJob.findUnique).mockResolvedValue(
        baseDbJob as any
      );
      vi.mocked(submitGeneration).mockResolvedValue({ taskId: 'task-fail-1' });
      vi.mocked(waitForCompletion).mockResolvedValue({
        status: 'FAILED',
        failure: 'content policy violation',
      } as any);

      await processVideoJob('job-001', mockBrand);

      expect(prisma.videoGenerationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            errorMessage: expect.stringContaining('content policy violation'),
          }),
        })
      );
    });

    it('re-queues the job and rethrows when error is retryable and retries remain', async () => {
      vi.mocked(isConfigured).mockReturnValue(false);
      vi.mocked(prisma.videoGenerationJob.update).mockResolvedValue({} as any);
      vi.mocked(prisma.videoGenerationJob.findUniqueOrThrow).mockResolvedValue(
        baseDbJob as any
      );
      vi.mocked(prisma.videoGenerationJob.findUnique).mockResolvedValue(
        { ...baseDbJob, retryCount: 0, maxRetries: 2 } as any
      );

      // Create a retryable RunwayApiError
      const RetryableError = vi.mocked(RunwayApiError);
      const retryableErr = new RetryableError('Rate limit exceeded', true);
      vi.mocked(generateVideo).mockRejectedValue(retryableErr);

      await expect(processVideoJob('job-001', mockBrand)).rejects.toThrow(
        'Rate limit exceeded'
      );

      expect(prisma.videoGenerationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'queued',
            retryCount: { increment: 1 },
          }),
        })
      );
    });

    it('sets status to failed without rethrowing when error is non-retryable', async () => {
      vi.mocked(isConfigured).mockReturnValue(false);
      vi.mocked(prisma.videoGenerationJob.update).mockResolvedValue({} as any);
      vi.mocked(prisma.videoGenerationJob.findUniqueOrThrow).mockResolvedValue(
        baseDbJob as any
      );
      vi.mocked(prisma.videoGenerationJob.findUnique).mockResolvedValue(
        baseDbJob as any
      );
      vi.mocked(generateVideo).mockRejectedValue(
        new Error('Invalid prompt content')
      );

      // Should resolve (not throw) — the error is swallowed after marking failed
      await expect(processVideoJob('job-001', mockBrand)).resolves.toBeUndefined();

      expect(prisma.videoGenerationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            errorMessage: 'Invalid prompt content',
          }),
        })
      );
    });
  });
});
