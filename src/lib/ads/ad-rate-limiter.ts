/**
 * Per-platform ad API rate limiter using Redis sliding window.
 * Enforces platform-specific limits before making external API calls.
 */

import { redis } from "@/lib/redis";
import type { AdPlatform, AdRateLimitConfig } from "./types";
import { AD_PLATFORM_RATE_LIMITS } from "./types";

export class AdRateLimitError extends Error {
  readonly platform: AdPlatform;
  readonly retryAfterMs: number;

  constructor(platform: AdPlatform, retryAfterMs: number) {
    super(
      `Ad API rate limit exceeded for ${platform}. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`
    );
    this.name = "AdRateLimitError";
    this.platform = platform;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Checks and consumes one unit of rate limit for the given platform + account.
 * Throws AdRateLimitError if the limit is exceeded.
 *
 * @returns remaining request count in the current window
 */
export async function checkAdRateLimit(
  platform: AdPlatform,
  accountId: string
): Promise<{ remaining: number; resetMs: number }> {
  const config: AdRateLimitConfig = AD_PLATFORM_RATE_LIMITS[platform];
  const windowMs = config.windowSeconds * 1000;
  const key = `ad_rate_limit:${platform}:${accountId}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  pipeline.zcard(key);
  pipeline.pexpire(key, config.windowSeconds);

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) || 0;
  const remaining = Math.max(0, config.maxRequests - count);

  if (count > config.maxRequests) {
    // Find oldest entry to compute reset time
    const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
    const oldestTs = oldest.length >= 2 ? Number(oldest[1]) : now;
    const resetMs = oldestTs + windowMs - now;

    throw new AdRateLimitError(platform, Math.max(resetMs, 1000));
  }

  return { remaining, resetMs: windowMs };
}

/**
 * Returns current usage without consuming a request.
 * Useful for dashboard monitoring and budget exhaustion warnings.
 */
export async function getAdRateLimitUsage(
  platform: AdPlatform,
  accountId: string
): Promise<{ used: number; limit: number; remaining: number }> {
  const config = AD_PLATFORM_RATE_LIMITS[platform];
  const windowMs = config.windowSeconds * 1000;
  const key = `ad_rate_limit:${platform}:${accountId}`;
  const now = Date.now();

  await redis.zremrangebyscore(key, 0, now - windowMs);
  const used = await redis.zcard(key);

  return {
    used,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - used),
  };
}
