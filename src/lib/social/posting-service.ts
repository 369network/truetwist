import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import type { Platform, PostContent, PostJob, PublishResult } from "./types";
import { getPlatformAdapter } from "./platforms";
import { RateLimitManager } from "./rate-limit-manager";
import { oauth2Manager } from "./oauth2-manager";

const QUEUE_NAME = "post-publishing";

const RETRY_DELAYS = [
  60 * 1000,       // 1 minute
  5 * 60 * 1000,   // 5 minutes
  15 * 60 * 1000,  // 15 minutes
  60 * 60 * 1000,  // 1 hour
];

export interface PostingServiceConfig {
  redis: Redis;
  concurrency?: number;
  /** Called when a post is successfully published */
  onPublished?: (job: PostJob, result: PublishResult) => Promise<void>;
  /** Called when a post fails after all retries */
  onFailed?: (job: PostJob, error: string) => Promise<void>;
  /** Function to retrieve encrypted access token for a social account */
  getEncryptedToken: (socialAccountId: string) => Promise<{
    encryptedAccessToken: string;
    encryptedRefreshToken: string | null;
    expiresAt: Date | null;
    platform: Platform;
  }>;
  /** Function to update stored tokens after a refresh */
  updateStoredTokens: (
    socialAccountId: string,
    encryptedAccessToken: string,
    encryptedRefreshToken: string | null,
    expiresAt: Date | null
  ) => Promise<void>;
}

/**
 * Unified posting service that handles scheduling, rate limiting,
 * token management, and publishing across all platforms via BullMQ.
 */
export class PostingService {
  private queue: Queue;
  private worker: Worker | null = null;
  private rateLimitManager: RateLimitManager;
  private config: PostingServiceConfig;

  constructor(config: PostingServiceConfig) {
    this.config = config;
    this.rateLimitManager = new RateLimitManager(config.redis);

    this.queue = new Queue(QUEUE_NAME, {
      connection: config.redis,
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: "custom" },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  /**
   * Schedules a post for publishing. If schedule is provided, creates a delayed job.
   * Otherwise, publishes immediately (subject to rate limits).
   */
  async schedulePost(postJob: PostJob): Promise<string> {
    // Validate content before scheduling
    const adapter = getPlatformAdapter(postJob.platform);
    const errors = adapter.validateContent(postJob.content);
    if (errors.length > 0) {
      throw new Error(`Content validation failed: ${errors.join("; ")}`);
    }

    const jobOptions: Record<string, unknown> = {};

    if (postJob.schedule) {
      const delay = postJob.schedule.scheduledFor.getTime() - Date.now();
      if (delay > 0) {
        jobOptions.delay = delay;
      }
      if (postJob.schedule.isPriority) {
        jobOptions.priority = 1;
      }
    }

    const job = await this.queue.add(
      "publish",
      postJob,
      jobOptions as Parameters<Queue["add"]>[2]
    );

    return job.id!;
  }

  /**
   * Cancels a scheduled post by job ID.
   */
  async cancelPost(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;

    const state = await job.getState();
    if (state === "delayed" || state === "waiting") {
      await job.remove();
      return true;
    }
    return false;
  }

  /**
   * Starts the worker that processes the posting queue.
   */
  startWorker(): void {
    if (this.worker) return;

    this.worker = new Worker<PostJob>(
      QUEUE_NAME,
      async (job: Job<PostJob>) => {
        return this.processJob(job);
      },
      {
        connection: this.config.redis,
        concurrency: this.config.concurrency ?? 5,
        settings: {
          backoffStrategy: (attemptsMade: number) => {
            return RETRY_DELAYS[Math.min(attemptsMade - 1, RETRY_DELAYS.length - 1)];
          },
        },
      }
    );

    this.worker.on("completed", async (job: Job<PostJob>) => {
      const result = job.returnvalue as PublishResult;
      if (result?.success && this.config.onPublished) {
        await this.config.onPublished(job.data, result);
      }
    });

    this.worker.on("failed", async (job: Job<PostJob> | undefined, error: Error) => {
      if (job && this.config.onFailed) {
        await this.config.onFailed(job.data, error.message);
      }
    });
  }

  /**
   * Gracefully shuts down the worker and queue.
   */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
  }

  /**
   * Gets queue health stats.
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    completed: number;
  }> {
    const [waiting, active, delayed, failed, completed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getDelayedCount(),
      this.queue.getFailedCount(),
      this.queue.getCompletedCount(),
    ]);
    return { waiting, active, delayed, failed, completed };
  }

  // ---- Private ----

  private async processJob(job: Job<PostJob>): Promise<PublishResult> {
    const { platform, socialAccountId, content } = job.data;

    // Check rate limits
    const rateCheck = await this.rateLimitManager.canMakeRequest(
      platform,
      socialAccountId
    );
    if (!rateCheck.allowed) {
      const delay = rateCheck.resetAt.getTime() - Date.now();
      throw new Error(
        `Rate limited on ${platform}. Retry after ${Math.ceil(delay / 1000)}s`
      );
    }

    // Get and potentially refresh tokens
    const accessToken = await this.getValidAccessToken(socialAccountId);

    // Publish
    const adapter = getPlatformAdapter(platform);
    const result = await adapter.publish(accessToken, content);

    if (result.success) {
      // Record the API call for rate limiting
      await this.rateLimitManager.recordRequest(platform, socialAccountId);
    } else {
      throw new Error(result.error ?? "Publish failed");
    }

    return result;
  }

  private async getValidAccessToken(socialAccountId: string): Promise<string> {
    const stored = await this.config.getEncryptedToken(socialAccountId);

    // Check if token needs refresh
    if (
      stored.encryptedRefreshToken &&
      oauth2Manager.needsRefresh(stored.expiresAt)
    ) {
      const refreshed = await oauth2Manager.refreshTokens(
        stored.platform,
        stored.encryptedRefreshToken
      );

      if (refreshed) {
        await this.config.updateStoredTokens(
          socialAccountId,
          refreshed.encrypted.accessTokenEncrypted,
          refreshed.encrypted.refreshTokenEncrypted,
          refreshed.encrypted.expiresAt
        );
        return refreshed.tokens.accessToken;
      }
    }

    return oauth2Manager.decryptAccessToken(stored.encryptedAccessToken);
  }
}
