import { prisma } from '@/lib/prisma';
import {
  addPostingJob,
  addFanOutJobs,
  addAnalyticsJob,
  cancelPostingJob,
  reschedulePostingJob,
  addToDeadLetter,
} from '@/queues';
import { smartScheduler } from './smart-scheduler';
import type { Platform } from '@/lib/social/types';
import { randomUUID } from 'crypto';

// Valid state transitions for PostSchedule
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['queued', 'cancelled', 'draft'], // back to draft for editing
  queued: ['posting', 'cancelled', 'scheduled'], // reschedule back to scheduled
  posting: ['posted', 'failed'],
  posted: [], // terminal state
  failed: ['scheduled', 'cancelled'], // can retry (reschedule) or cancel
  cancelled: ['draft'], // can revive to draft
};

// Valid state transitions for Post (aggregate status)
const POST_STATUS_MAP: Record<string, string> = {
  draft: 'draft',
  scheduled: 'scheduled',
  queued: 'queued',
  posting: 'posting',
  posted: 'posted',
  failed: 'failed',
  cancelled: 'cancelled',
};

export class PostLifecycleManager {
  /**
   * Schedule a post to one or more platforms.
   * Creates PostSchedule records and enqueues BullMQ jobs.
   */
  async schedulePost(params: {
    postId: string;
    userId: string;
    platforms: Array<{
      socialAccountId: string;
      platform: Platform;
      scheduledAt: Date;
    }>;
    timezone: string;
  }): Promise<{ schedules: Array<{ id: string; platform: string; scheduledAt: Date; bullJobId: string | null }>; crossPostGroup: string | null }> {
    const { postId, userId, platforms, timezone } = params;

    // Validate all schedules
    for (const p of platforms) {
      const validation = await smartScheduler.validateSchedule(
        p.socialAccountId,
        p.platform,
        p.scheduledAt
      );
      if (!validation.valid) {
        throw new Error(`${p.platform}: ${validation.reason}`);
      }
    }

    // Generate cross-post group ID if posting to multiple platforms
    const crossPostGroup = platforms.length > 1 ? randomUUID() : null;

    // Create PostSchedule records
    const schedules = await Promise.all(
      platforms.map((p) =>
        prisma.postSchedule.create({
          data: {
            postId,
            socialAccountId: p.socialAccountId,
            platform: p.platform,
            scheduledAt: p.scheduledAt,
            status: 'scheduled',
            crossPostGroup,
          },
        })
      )
    );

    // Update post status to scheduled
    await prisma.post.update({
      where: { id: postId },
      data: { status: 'scheduled' },
    });

    // Enqueue BullMQ jobs
    if (crossPostGroup && platforms.length > 1) {
      await addFanOutJobs(
        postId,
        userId,
        schedules.map((s, i) => ({
          id: s.id,
          socialAccountId: platforms[i].socialAccountId,
          platform: platforms[i].platform,
          scheduledAt: platforms[i].scheduledAt,
        })),
        crossPostGroup
      );
    } else {
      const s = schedules[0];
      const p = platforms[0];
      const delay = Math.max(0, p.scheduledAt.getTime() - Date.now());
      const job = await addPostingJob(
        {
          postScheduleId: s.id,
          postId,
          socialAccountId: p.socialAccountId,
          platform: p.platform,
        },
        delay
      );

      await prisma.postSchedule.update({
        where: { id: s.id },
        data: { bullJobId: job.id },
      });
    }

    // Return schedule info
    const result = schedules.map((s, i) => ({
      id: s.id,
      platform: platforms[i].platform,
      scheduledAt: platforms[i].scheduledAt,
      bullJobId: s.bullJobId,
    }));

    return { schedules: result, crossPostGroup };
  }

  /**
   * Transition a PostSchedule to a new status with validation.
   */
  async transitionScheduleStatus(
    scheduleId: string,
    newStatus: string,
    metadata?: { errorMessage?: string; platformPostId?: string; platformPostUrl?: string }
  ): Promise<void> {
    const schedule = await prisma.postSchedule.findUniqueOrThrow({
      where: { id: scheduleId },
    });

    const allowed = VALID_TRANSITIONS[schedule.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(
        `Invalid transition: ${schedule.status} → ${newStatus}. Allowed: ${allowed?.join(', ') || 'none'}`
      );
    }

    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === 'posted') {
      updateData.postedAt = new Date();
      if (metadata?.platformPostId) updateData.platformPostId = metadata.platformPostId;
      if (metadata?.platformPostUrl) updateData.platformPostUrl = metadata.platformPostUrl;
    }

    if (newStatus === 'failed' && metadata?.errorMessage) {
      updateData.errorMessage = metadata.errorMessage;
      updateData.retryCount = schedule.retryCount + 1;
    }

    await prisma.postSchedule.update({
      where: { id: scheduleId },
      data: updateData,
    });

    // Update aggregate post status
    await this.syncPostStatus(schedule.postId);
  }

  /**
   * Syncs the parent Post status based on its schedules' statuses.
   * Priority: posting > queued > scheduled > failed > posted > cancelled > draft
   */
  async syncPostStatus(postId: string): Promise<void> {
    const schedules = await prisma.postSchedule.findMany({
      where: { postId },
      select: { status: true },
    });

    if (schedules.length === 0) return;

    const statuses = schedules.map((s) => s.status);

    let aggregateStatus: string;
    if (statuses.includes('posting')) {
      aggregateStatus = 'posting';
    } else if (statuses.includes('queued')) {
      aggregateStatus = 'queued';
    } else if (statuses.includes('scheduled')) {
      aggregateStatus = 'scheduled';
    } else if (statuses.every((s) => s === 'posted')) {
      aggregateStatus = 'posted';
    } else if (statuses.every((s) => s === 'cancelled')) {
      aggregateStatus = 'cancelled';
    } else if (statuses.some((s) => s === 'failed')) {
      aggregateStatus = 'failed';
    } else if (statuses.every((s) => s === 'draft')) {
      aggregateStatus = 'draft';
    } else {
      aggregateStatus = 'scheduled'; // default fallback
    }

    await prisma.post.update({
      where: { id: postId },
      data: { status: aggregateStatus },
    });
  }

  /**
   * Cancel a scheduled post. Removes BullMQ job and updates status.
   */
  async cancelSchedule(scheduleId: string): Promise<void> {
    const schedule = await prisma.postSchedule.findUniqueOrThrow({
      where: { id: scheduleId },
    });

    if (!['scheduled', 'queued', 'draft'].includes(schedule.status)) {
      throw new Error(`Cannot cancel a schedule in "${schedule.status}" status`);
    }

    // Remove from BullMQ if queued
    if (schedule.bullJobId) {
      await cancelPostingJob(schedule.id);
    }

    await this.transitionScheduleStatus(scheduleId, 'cancelled');
  }

  /**
   * Cancel all schedules for a post.
   */
  async cancelAllSchedules(postId: string): Promise<number> {
    const schedules = await prisma.postSchedule.findMany({
      where: {
        postId,
        status: { in: ['scheduled', 'queued', 'draft'] },
      },
    });

    let cancelled = 0;
    for (const s of schedules) {
      try {
        await this.cancelSchedule(s.id);
        cancelled++;
      } catch {
        // skip if can't cancel (e.g., already posting)
      }
    }
    return cancelled;
  }

  /**
   * Reschedule a post to a new time.
   */
  async reschedulePost(
    scheduleId: string,
    newScheduledAt: Date
  ): Promise<void> {
    const schedule = await prisma.postSchedule.findUniqueOrThrow({
      where: { id: scheduleId },
      include: { post: true },
    });

    if (!['scheduled', 'queued', 'failed'].includes(schedule.status)) {
      throw new Error(`Cannot reschedule a post in "${schedule.status}" status`);
    }

    // Validate the new time
    const validation = await smartScheduler.validateSchedule(
      schedule.socialAccountId,
      schedule.platform as Platform,
      newScheduledAt
    );
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    // Cancel existing BullMQ job and create new one
    const delay = Math.max(0, newScheduledAt.getTime() - Date.now());
    if (schedule.bullJobId) {
      await cancelPostingJob(schedule.id);
    }

    const job = await addPostingJob(
      {
        postScheduleId: schedule.id,
        postId: schedule.postId,
        socialAccountId: schedule.socialAccountId,
        platform: schedule.platform,
      },
      delay
    );

    await prisma.postSchedule.update({
      where: { id: scheduleId },
      data: {
        scheduledAt: newScheduledAt,
        status: 'scheduled',
        bullJobId: job.id,
        errorMessage: null,
        retryCount: schedule.status === 'failed' ? schedule.retryCount : 0,
      },
    });

    await this.syncPostStatus(schedule.postId);
  }

  /**
   * Handle successful publish: update status, trigger analytics collection.
   */
  async onPublished(
    scheduleId: string,
    platformPostId: string,
    platformPostUrl?: string
  ): Promise<void> {
    await this.transitionScheduleStatus(scheduleId, 'posted', {
      platformPostId,
      platformPostUrl,
    });

    // Queue analytics fetch for 5 minutes after posting
    const schedule = await prisma.postSchedule.findUniqueOrThrow({
      where: { id: scheduleId },
    });

    await addAnalyticsJob({
      postScheduleId: scheduleId,
      platform: schedule.platform,
      platformPostId,
    });
  }

  /**
   * Handle failed publish: update status, move to DLQ if max retries exceeded.
   */
  async onFailed(
    scheduleId: string,
    errorMessage: string,
    attemptsMade: number
  ): Promise<void> {
    const schedule = await prisma.postSchedule.findUniqueOrThrow({
      where: { id: scheduleId },
    });

    if (attemptsMade >= schedule.maxRetries) {
      // Move to dead letter queue
      await addToDeadLetter({
        originalQueue: 'posting-queue',
        originalJobId: schedule.bullJobId || scheduleId,
        originalData: {
          postScheduleId: scheduleId,
          postId: schedule.postId,
          socialAccountId: schedule.socialAccountId,
          platform: schedule.platform,
        },
        failedAt: new Date().toISOString(),
        errorMessage,
        attempts: attemptsMade,
      });
    }

    await this.transitionScheduleStatus(scheduleId, 'failed', { errorMessage });
  }

  /**
   * Get cross-post tracking info: all schedules linked by crossPostGroup.
   */
  async getCrossPostStatus(crossPostGroup: string) {
    return prisma.postSchedule.findMany({
      where: { crossPostGroup },
      include: {
        socialAccount: {
          select: { id: true, platform: true, accountName: true, accountHandle: true },
        },
        analytics: {
          orderBy: { fetchedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { platform: 'asc' },
    });
  }

  /**
   * Edit a scheduled post's content (only before posting).
   */
  async editScheduledPost(
    postId: string,
    userId: string,
    updates: { contentText?: string; contentType?: string }
  ): Promise<void> {
    const post = await prisma.post.findFirst({
      where: { id: postId, userId },
      include: { schedules: { where: { status: { in: ['posting'] } } } },
    });

    if (!post) throw new Error('Post not found');
    if (post.schedules.length > 0) {
      throw new Error('Cannot edit a post that is currently being published');
    }

    if (!['draft', 'scheduled', 'failed'].includes(post.status)) {
      throw new Error(`Cannot edit a post in "${post.status}" status`);
    }

    await prisma.post.update({
      where: { id: postId },
      data: updates,
    });
  }
}

export const postLifecycle = new PostLifecycleManager();
