import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import type { Platform, PostAnalytics } from "./types";
import { getPlatformAdapter, isPlatformSupported } from "./platforms";
import { oauth2Manager } from "./oauth2-manager";

const QUEUE_NAME = "analytics-fetch";
const COLLECTION_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface AnalyticsJobData {
  postPlatformId: string;
  socialAccountId: string;
  platform: Platform;
  platformPostId: string;
}

export interface AnalyticsServiceConfig {
  redis: Redis;
  concurrency?: number;
  /** Function to retrieve encrypted access token for a social account */
  getEncryptedToken: (socialAccountId: string) => Promise<{
    encryptedAccessToken: string;
    encryptedRefreshToken: string | null;
    expiresAt: Date | null;
    platform: Platform;
  }>;
  /** Called when analytics are successfully fetched */
  onAnalyticsFetched: (
    postPlatformId: string,
    analytics: PostAnalytics
  ) => Promise<void>;
  /** Function to get all published posts that need analytics updates */
  getPublishedPosts: () => Promise<AnalyticsJobData[]>;
}

/**
 * Service that periodically fetches post analytics from all platforms.
 * Runs every 6 hours, fetching metrics for all published posts.
 */
export class AnalyticsService {
  private queue: Queue;
  private worker: Worker | null = null;
  private config: AnalyticsServiceConfig;
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: AnalyticsServiceConfig) {
    this.config = config;

    this.queue = new Queue(QUEUE_NAME, {
      connection: config.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 30000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
      },
    });
  }

  /**
   * Starts the analytics worker and the periodic scheduler.
   */
  start(): void {
    this.startWorker();
    this.startScheduler();
  }

  /**
   * Manually triggers an analytics collection for all published posts.
   */
  async triggerCollection(): Promise<number> {
    const posts = await this.config.getPublishedPosts();
    let queued = 0;

    for (const post of posts) {
      if (!isPlatformSupported(post.platform)) continue;

      await this.queue.add("fetch-analytics", post, {
        jobId: `analytics:${post.postPlatformId}:${Date.now()}`,
      });
      queued++;
    }

    return queued;
  }

  /**
   * Fetches analytics for a single post on demand.
   */
  async fetchSinglePostAnalytics(
    postPlatformId: string,
    socialAccountId: string,
    platform: Platform,
    platformPostId: string
  ): Promise<PostAnalytics> {
    const accessToken = await this.getValidAccessToken(socialAccountId);
    const adapter = getPlatformAdapter(platform);
    return adapter.fetchAnalytics(accessToken, platformPostId);
  }

  /**
   * Calculates engagement rate from raw metrics.
   */
  static calculateEngagementRate(analytics: PostAnalytics): number {
    if (analytics.impressions === 0) return 0;
    const engagements =
      analytics.likes +
      analytics.comments +
      analytics.shares +
      analytics.saves +
      analytics.clicks;
    return engagements / analytics.impressions;
  }

  async shutdown(): Promise<void> {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
  }

  // ---- Private ----

  private startWorker(): void {
    if (this.worker) return;

    this.worker = new Worker<AnalyticsJobData>(
      QUEUE_NAME,
      async (job: Job<AnalyticsJobData>) => {
        const { postPlatformId, socialAccountId, platform, platformPostId } =
          job.data;

        const accessToken = await this.getValidAccessToken(socialAccountId);
        const adapter = getPlatformAdapter(platform);
        const analytics = await adapter.fetchAnalytics(
          accessToken,
          platformPostId
        );

        await this.config.onAnalyticsFetched(postPlatformId, analytics);
        return analytics;
      },
      {
        connection: this.config.redis,
        concurrency: this.config.concurrency ?? 3,
      }
    );
  }

  private startScheduler(): void {
    // Run immediately on start, then every 6 hours
    this.triggerCollection().catch(() => {});

    this.schedulerInterval = setInterval(() => {
      this.triggerCollection().catch(() => {});
    }, COLLECTION_INTERVAL_MS);
  }

  private async getValidAccessToken(socialAccountId: string): Promise<string> {
    const stored = await this.config.getEncryptedToken(socialAccountId);

    if (
      stored.encryptedRefreshToken &&
      oauth2Manager.needsRefresh(stored.expiresAt)
    ) {
      const refreshed = await oauth2Manager.refreshTokens(
        stored.platform,
        stored.encryptedRefreshToken
      );
      if (refreshed) {
        return refreshed.tokens.accessToken;
      }
    }

    return oauth2Manager.decryptAccessToken(stored.encryptedAccessToken);
  }
}
