import { prisma } from '@/lib/prisma';
import { contentGenerationQueue } from '@/queues';
import {
  submitGeneration,
  getTaskStatus,
  waitForCompletion,
  estimateCostCents,
  isConfigured,
  RunwayApiError,
} from './runway-client';
import { generateVideo as generateVideoFoundation } from './video-generation-service';
import {
  getProvider,
  getDefaultProvider,
  mapTemplate,
  VideoProviderError,
} from '@/lib/video-providers';
import type { VideoProviderName } from '@/lib/video-providers';
import type { BrandContext, VideoAspectRatio, VideoTemplate } from './types';
import type { Platform } from '@/lib/social/types';

// ============================================
// Video Generation Queue Service
// ============================================

/**
 * Resolve which provider string to store on the job record.
 * Priority: explicit preference → Synthesia → HeyGen → Runway → fallback.
 */
function resolveProvider(preferred?: VideoProviderName): string {
  if (preferred) {
    const provider = getProvider(preferred);
    if (provider.isConfigured()) return preferred;
  }

  const defaultProvider = getDefaultProvider();
  if (defaultProvider) return defaultProvider.name;

  // Legacy path: Runway or fallback
  return isConfigured() ? 'runway' : 'fallback';
}

export type VideoJobStatus = 'queued' | 'generating' | 'processing' | 'ready' | 'failed';

export interface QueueVideoRequest {
  userId: string;
  businessId: string;
  prompt: string;
  platform: Platform;
  template?: string;
  aspectRatio: VideoAspectRatio;
  durationSeconds: number;
  scriptJson?: Record<string, unknown>;
  brand: BrandContext;
  batchGroup?: string;
  parentJobId?: string;
  metadata?: Record<string, unknown>;
  /** Explicitly request a provider. Falls back to auto-selection if omitted. */
  preferredProvider?: VideoProviderName;
  avatarId?: string;
  voiceId?: string;
}

export interface VideoJobSummary {
  id: string;
  status: VideoJobStatus;
  platform: string;
  aspectRatio: string;
  durationSeconds: number;
  outputVideoUrl: string | null;
  thumbnailUrl: string | null;
  costCents: number;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * Enqueue a new video generation job. Creates a DB record and pushes to BullMQ.
 */
export async function queueVideoGeneration(req: QueueVideoRequest): Promise<VideoJobSummary> {
  const costEstimate = estimateCostCents(req.durationSeconds);

  // Resolve which provider to use
  const resolvedProvider = resolveProvider(req.preferredProvider);

  const job = await prisma.videoGenerationJob.create({
    data: {
      userId: req.userId,
      businessId: req.businessId,
      prompt: req.prompt,
      platform: req.platform,
      template: req.template ?? null,
      aspectRatio: req.aspectRatio,
      durationSeconds: req.durationSeconds,
      scriptJson: req.scriptJson ? JSON.parse(JSON.stringify(req.scriptJson)) : undefined,
      costCents: costEstimate,
      provider: resolvedProvider,
      parentJobId: req.parentJobId ?? null,
      batchGroup: req.batchGroup ?? null,
      metadata: {
        ...(req.metadata ? JSON.parse(JSON.stringify(req.metadata)) : {}),
        ...(req.avatarId ? { avatarId: req.avatarId } : {}),
        ...(req.voiceId ? { voiceId: req.voiceId } : {}),
      },
    },
  });

  // Push to BullMQ for async processing
  await contentGenerationQueue.add(
    'video-generate',
    { videoJobId: job.id, brand: req.brand },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
      jobId: `video-${job.id}`,
    }
  );

  return toJobSummary(job);
}

/**
 * Process a video generation job (called by BullMQ worker).
 */
export async function processVideoJob(videoJobId: string, brand: BrandContext): Promise<void> {
  await prisma.videoGenerationJob.update({
    where: { id: videoJobId },
    data: { status: 'generating', startedAt: new Date() },
  });

  try {
    const job = await prisma.videoGenerationJob.findUniqueOrThrow({
      where: { id: videoJobId },
    });

    let videoUrl: string;
    let thumbnailUrl: string | undefined;

    if (job.provider === 'synthesia' || job.provider === 'heygen') {
      // Use provider abstraction for Synthesia/HeyGen
      const provider = getProvider(job.provider as VideoProviderName);
      const meta = (job.metadata ?? {}) as Record<string, unknown>;
      const mapped = mapTemplate(
        job.provider as VideoProviderName,
        job.template as VideoTemplate | undefined,
        job.prompt
      );

      const result = await provider.generate({
        prompt: mapped.enrichedScript,
        scriptText: mapped.enrichedScript,
        aspectRatio: job.aspectRatio as VideoAspectRatio,
        durationSeconds: job.durationSeconds,
        templateId: mapped.providerId || undefined,
        avatarId: mapped.avatarId || (meta.avatarId as string | undefined),
        voiceId: mapped.voiceId || (meta.voiceId as string | undefined),
        backgroundUrl: meta.backgroundUrl as string | undefined,
      });

      await prisma.videoGenerationJob.update({
        where: { id: videoJobId },
        data: { providerJobId: result.providerJobId },
      });

      if (result.status === 'failed') {
        throw new Error(`${job.provider} generation failed: ${result.errorMessage ?? 'unknown'}`);
      }

      // For webhook-based providers, the job stays in "generating" until
      // the webhook callback updates it. We set the URL if already available.
      videoUrl = result.videoUrl ?? '';
      thumbnailUrl = result.thumbnailUrl;

      if (result.status === 'pending' || result.status === 'processing') {
        // Job is async — will be completed via webhook. Mark as generating and return.
        await prisma.videoGenerationJob.update({
          where: { id: videoJobId },
          data: {
            status: 'generating',
            sourceVideoUrl: videoUrl || null,
            thumbnailUrl: thumbnailUrl ?? null,
          },
        });
        return;
      }
    } else if (isConfigured()) {
      // Use Runway Gen-3
      const { taskId } = await submitGeneration({
        prompt: job.prompt,
        aspectRatio: job.aspectRatio as VideoAspectRatio,
        durationSeconds: job.durationSeconds,
      });

      await prisma.videoGenerationJob.update({
        where: { id: videoJobId },
        data: { runwayTaskId: taskId },
      });

      const result = await waitForCompletion(taskId);

      if (result.status === 'FAILED') {
        throw new Error(`Runway generation failed: ${result.failure ?? 'unknown'}`);
      }

      videoUrl = result.output?.[0] ?? '';
      if (!videoUrl) {
        throw new Error('Runway returned no output URL');
      }
    } else {
      // Fallback: use foundation (GPT-4o script + DALL-E thumbnail)
      const fallback = await generateVideoFoundation(
        {
          userId: job.userId,
          businessId: job.businessId,
          prompt: job.prompt,
          platform: job.platform as Platform,
          template: job.template as any,
          aspectRatio: job.aspectRatio as VideoAspectRatio,
          durationSeconds: job.durationSeconds,
        },
        brand
      );
      videoUrl = fallback.video.url || '';
      thumbnailUrl = fallback.video.thumbnailUrl;
    }

    // Move to processing for post-processing step
    await prisma.videoGenerationJob.update({
      where: { id: videoJobId },
      data: {
        status: 'processing',
        sourceVideoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl ?? null,
      },
    });

    // Post-processing would happen here (format conversion, watermark, etc.)
    // For now, output = source
    const finalCost = estimateCostCents(job.durationSeconds);

    await prisma.videoGenerationJob.update({
      where: { id: videoJobId },
      data: {
        status: 'ready',
        outputVideoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl ?? null,
        costCents: finalCost,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isRetryable =
      (error instanceof RunwayApiError && error.isRetryable) ||
      (error instanceof VideoProviderError && error.isRetryable);

    const currentJob = await prisma.videoGenerationJob.findUnique({
      where: { id: videoJobId },
    });

    if (isRetryable && currentJob && currentJob.retryCount < currentJob.maxRetries) {
      await prisma.videoGenerationJob.update({
        where: { id: videoJobId },
        data: {
          retryCount: { increment: 1 },
          status: 'queued',
          errorMessage: message,
        },
      });
      throw error; // Let BullMQ retry
    }

    await prisma.videoGenerationJob.update({
      where: { id: videoJobId },
      data: {
        status: 'failed',
        errorMessage: message,
        completedAt: new Date(),
      },
    });
  }
}

/**
 * Get a video generation job by ID.
 */
export async function getVideoJob(jobId: string, userId: string): Promise<VideoJobSummary | null> {
  const job = await prisma.videoGenerationJob.findFirst({
    where: { id: jobId, userId },
  });
  return job ? toJobSummary(job) : null;
}

/**
 * List video generation jobs for a user.
 */
export async function listVideoJobs(
  userId: string,
  options?: { status?: VideoJobStatus; batchGroup?: string; limit?: number; offset?: number }
): Promise<VideoJobSummary[]> {
  const jobs = await prisma.videoGenerationJob.findMany({
    where: {
      userId,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.batchGroup ? { batchGroup: options.batchGroup } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 20,
    skip: options?.offset ?? 0,
  });
  return jobs.map(toJobSummary);
}

/**
 * Cancel a queued/generating video job.
 */
export async function cancelVideoJob(jobId: string, userId: string): Promise<boolean> {
  const job = await prisma.videoGenerationJob.findFirst({
    where: { id: jobId, userId, status: { in: ['queued', 'generating'] } },
  });
  if (!job) return false;

  await prisma.videoGenerationJob.update({
    where: { id: jobId },
    data: { status: 'failed', errorMessage: 'Cancelled by user', completedAt: new Date() },
  });

  // Remove from BullMQ if still queued
  const bullJob = await contentGenerationQueue.getJob(`video-${jobId}`);
  if (bullJob) {
    const state = await bullJob.getState();
    if (state === 'delayed' || state === 'waiting') {
      await bullJob.remove();
    }
  }

  return true;
}

function toJobSummary(job: {
  id: string;
  status: string;
  platform: string;
  aspectRatio: string;
  durationSeconds: number;
  outputVideoUrl: string | null;
  thumbnailUrl: string | null;
  costCents: number;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}): VideoJobSummary {
  return {
    id: job.id,
    status: job.status as VideoJobStatus,
    platform: job.platform,
    aspectRatio: job.aspectRatio,
    durationSeconds: job.durationSeconds,
    outputVideoUrl: job.outputVideoUrl,
    thumbnailUrl: job.thumbnailUrl,
    costCents: job.costCents,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}
