import { redis } from '@/lib/redis';
import { Errors } from '@/lib/errors';

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

const PLAN_LIMITS: Record<string, number> = {
  free: 30,
  starter: 120,
  pro: 300,
  enterprise: 1000,
};

export async function checkRateLimit(
  identifier: string,
  config?: RateLimitConfig
): Promise<{ remaining: number; reset: number }> {
  const windowMs = config?.windowMs || 60000; // 1 minute default
  const max = config?.max || 60;

  const now = Date.now();
  const windowStart = now - windowMs;
  const key = `rate_limit:${identifier}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  pipeline.zcard(key);
  pipeline.pexpire(key, windowMs);

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) || 0;

  if (count > max) {
    throw Errors.rateLimited();
  }

  return {
    remaining: Math.max(0, max - count),
    reset: Math.ceil((now + windowMs) / 1000),
  };
}

export function getRateLimitForPlan(plan: string): number {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}
