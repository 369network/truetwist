import Redis from "ioredis";
import type { Platform, RateLimitConfig } from "./types";
import { PLATFORM_RATE_LIMITS } from "./types";

/**
 * Redis-based rate limit manager using the sliding window algorithm.
 * Tracks API usage per platform per social account and enforces limits.
 */
export class RateLimitManager {
  private redis: Redis;
  private keyPrefix = "ratelimit";

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private getKey(platform: Platform, accountId: string): string {
    return `${this.keyPrefix}:${platform}:${accountId}`;
  }

  /**
   * Checks whether a request can be made without exceeding the rate limit.
   * Does NOT consume the request — call `recordRequest` after a successful API call.
   */
  async canMakeRequest(
    platform: Platform,
    accountId: string
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const config = PLATFORM_RATE_LIMITS[platform];
    const key = this.getKey(platform, accountId);
    const now = Date.now();
    const windowStart = now - config.windowSeconds * 1000;

    // Count requests in the current window using sorted set
    const count = await this.redis.zcount(key, windowStart, "+inf");
    const remaining = Math.max(0, config.maxRequests - count);
    const allowed = count < config.maxRequests;

    // Estimate when the oldest request in the window will expire
    const oldestEntries = await this.redis.zrangebyscore(
      key,
      windowStart,
      "+inf",
      "LIMIT",
      0,
      1
    );
    let resetAt: Date;
    if (oldestEntries.length > 0 && !allowed) {
      const oldestScore = await this.redis.zscore(key, oldestEntries[0]);
      resetAt = new Date(
        Number(oldestScore) + config.windowSeconds * 1000
      );
    } else {
      resetAt = new Date(now + config.windowSeconds * 1000);
    }

    return { allowed, remaining, resetAt };
  }

  /**
   * Records a successful API request in the rate limit window.
   */
  async recordRequest(platform: Platform, accountId: string): Promise<void> {
    const config = PLATFORM_RATE_LIMITS[platform];
    const key = this.getKey(platform, accountId);
    const now = Date.now();
    const windowStart = now - config.windowSeconds * 1000;
    const requestId = `${now}:${Math.random().toString(36).slice(2, 8)}`;

    const pipeline = this.redis.pipeline();
    // Add current request with timestamp as score
    pipeline.zadd(key, now, requestId);
    // Remove entries outside the window
    pipeline.zremrangebyscore(key, "-inf", windowStart);
    // Set TTL to clean up old keys
    pipeline.expire(key, config.windowSeconds + 60);
    await pipeline.exec();
  }

  /**
   * Returns the optimal delay in ms before the next request can be made.
   * Returns 0 if a request can be made immediately.
   */
  async getOptimalDelay(
    platform: Platform,
    accountId: string
  ): Promise<number> {
    const { allowed, resetAt } = await this.canMakeRequest(
      platform,
      accountId
    );
    if (allowed) return 0;
    return Math.max(0, resetAt.getTime() - Date.now());
  }

  /**
   * Clears rate limit data for a specific account (e.g. on disconnect).
   */
  async clearLimits(platform: Platform, accountId: string): Promise<void> {
    await this.redis.del(this.getKey(platform, accountId));
  }

  /**
   * Gets current usage stats for a platform/account.
   */
  async getUsage(
    platform: Platform,
    accountId: string
  ): Promise<{ used: number; limit: number; windowSeconds: number }> {
    const config = PLATFORM_RATE_LIMITS[platform];
    const key = this.getKey(platform, accountId);
    const windowStart = Date.now() - config.windowSeconds * 1000;
    const used = await this.redis.zcount(key, windowStart, "+inf");
    return {
      used,
      limit: config.maxRequests,
      windowSeconds: config.windowSeconds,
    };
  }
}
