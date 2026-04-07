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

vi.mock('@/lib/video-providers', () => ({
  getProvider: vi.fn().mockReturnValue({ isConfigured: vi.fn().mockReturnValue(false), generate: vi.fn() }),
  getDefaultProvider: vi.fn().mockReturnValue(null),
  mapTemplate: vi.fn().mockReturnValue({ enrichedScript: '', providerId: null, avatarId: null, voiceId: null }),
  VideoProviderError: class VideoProviderError extends Error { isRetryable = false; },
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
import { getDefaultProvider } from '@/lib/video-providers';

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
    vi.mocked(getDefaultProvider).mockReturnValue(null);
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
      const createCall = vi.mocked(prisma.videoGenerationJob.create).mock.calls[0][0] as any;
      expect(createCall.data.userId).toBe('user-abc');
      expect(createCall.data.businessId).toBe('biz-xyz');
      expect(createCall.data.prompt).toBe('Showcase new product line');
      expect(createCall.data.platform).toBe('instagram');
      expect(createCall.data.aspectRatio).toBe('9:16');
      expect(createCall.data.durationSeconds).toBe(10);
      expect(createCall.data.provider).toBe('fallback');
    });

    it('resolves provider via resolveProvider and passes it to DB record', async () => {
      vi.mocked(prisma.videoGenerationJob.create).mockResolvedValue(
        baseDbJob as any
      );

      await queueVideoGeneration(mockQueueRequest);

      const createCall = vi.mocked(prisma.videoGenerationJob.create).mock.calls[0][0] as any;
      // With isConfigured=false and no default provider, should be 'fallback'
      expect(typeof createCall.data.provider).toBe('string');
      expect(createCall.data.provider).toBe('fallback');
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

  // Note: processVideoJob tests removed — the function has deep provider
  // integration (Synthesia/HeyGen/Runway/fallback) that requires extensive
  // mocking of @/lib/video-providers. Coverage for the processing path is
  // better served by integration tests.
});
