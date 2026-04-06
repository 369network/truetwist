import { prisma } from '@/lib/prisma';
import type { Platform } from '@/lib/social/types';
import { PLATFORM_RATE_LIMITS } from '@/lib/social/types';

// Default optimal posting times (industry research) when no historical data exists
// Format: { dayOfWeek: { hourUtc: score } }
const DEFAULT_OPTIMAL_TIMES: Record<Platform, Record<number, Record<number, number>>> = {
  instagram: {
    1: { 11: 0.9, 14: 0.85, 17: 0.8 }, // Monday
    2: { 10: 0.88, 13: 0.85, 19: 0.8 },
    3: { 11: 0.92, 14: 0.87, 17: 0.82 }, // Wednesday peak
    4: { 10: 0.86, 14: 0.84, 20: 0.8 },
    5: { 9: 0.85, 13: 0.9, 17: 0.85 }, // Friday
    6: { 10: 0.75, 14: 0.7 },
    0: { 10: 0.7, 17: 0.72 },
  },
  tiktok: {
    1: { 12: 0.88, 16: 0.85, 21: 0.9 },
    2: { 9: 0.85, 15: 0.87, 20: 0.9 },
    3: { 12: 0.86, 17: 0.88, 21: 0.92 },
    4: { 15: 0.87, 19: 0.9, 21: 0.88 },
    5: { 12: 0.85, 17: 0.9, 21: 0.92 },
    6: { 11: 0.8, 16: 0.82, 21: 0.85 },
    0: { 13: 0.78, 19: 0.8 },
  },
  twitter: {
    1: { 8: 0.88, 12: 0.9, 17: 0.85 },
    2: { 9: 0.87, 12: 0.88, 18: 0.84 },
    3: { 8: 0.9, 12: 0.92, 17: 0.88 },
    4: { 9: 0.86, 12: 0.87, 18: 0.83 },
    5: { 8: 0.84, 12: 0.85, 15: 0.82 },
    6: { 10: 0.7 },
    0: { 12: 0.68 },
  },
  facebook: {
    1: { 9: 0.85, 13: 0.88, 16: 0.84 },
    2: { 9: 0.87, 12: 0.86, 15: 0.83 },
    3: { 9: 0.9, 12: 0.88, 15: 0.85 },
    4: { 9: 0.86, 13: 0.87, 16: 0.84 },
    5: { 9: 0.83, 12: 0.84, 15: 0.8 },
    6: { 10: 0.72, 14: 0.7 },
    0: { 10: 0.68, 15: 0.7 },
  },
  linkedin: {
    1: { 8: 0.85, 10: 0.9, 12: 0.88 },
    2: { 8: 0.9, 10: 0.92, 12: 0.87 },
    3: { 8: 0.88, 10: 0.9, 12: 0.86 },
    4: { 8: 0.87, 10: 0.88, 14: 0.84 },
    5: { 8: 0.82, 10: 0.84 },
    6: {},
    0: {},
  },
  youtube: {
    1: { 14: 0.82, 17: 0.85, 20: 0.88 },
    2: { 14: 0.84, 17: 0.87, 20: 0.86 },
    3: { 14: 0.83, 17: 0.86, 20: 0.85 },
    4: { 12: 0.85, 15: 0.88, 20: 0.9 },
    5: { 12: 0.9, 15: 0.92, 20: 0.88 },
    6: { 10: 0.85, 14: 0.87, 18: 0.85 },
    0: { 10: 0.83, 14: 0.85, 18: 0.82 },
  },
  pinterest: {
    1: { 14: 0.82, 20: 0.88, 22: 0.85 },
    2: { 14: 0.84, 20: 0.87, 22: 0.84 },
    3: { 14: 0.83, 20: 0.86, 22: 0.83 },
    4: { 14: 0.85, 20: 0.88, 22: 0.86 },
    5: { 14: 0.9, 20: 0.92, 22: 0.88 },
    6: { 10: 0.82, 14: 0.85, 20: 0.87 },
    0: { 10: 0.8, 14: 0.83, 20: 0.85 },
  },
  threads: {
    1: { 11: 0.85, 14: 0.82, 17: 0.8 },
    2: { 10: 0.84, 13: 0.82, 19: 0.78 },
    3: { 11: 0.88, 14: 0.84, 17: 0.8 },
    4: { 10: 0.82, 14: 0.8, 20: 0.78 },
    5: { 9: 0.8, 13: 0.85, 17: 0.82 },
    6: { 10: 0.72, 14: 0.68 },
    0: { 10: 0.68, 17: 0.7 },
  },
};

// Minimum intervals between posts on the same platform (in minutes)
const MIN_POSTING_INTERVALS: Record<Platform, number> = {
  instagram: 60,   // 1 hour between posts
  tiktok: 120,     // 2 hours (max 3/day)
  twitter: 15,     // 15 minutes between tweets
  facebook: 60,    // 1 hour
  linkedin: 120,   // 2 hours
  youtube: 240,    // 4 hours
  pinterest: 30,   // 30 minutes
  threads: 30,     // 30 minutes
};

// Daily post limits per platform
const DAILY_POST_LIMITS: Record<Platform, number> = {
  instagram: 25,
  tiktok: 3,
  twitter: 50,
  facebook: 25,
  linkedin: 10,
  youtube: 6,
  pinterest: 50,
  threads: 25,
};

export interface OptimalSlot {
  scheduledAt: Date;
  score: number;
  isDefault: boolean; // true if based on defaults, false if data-driven
}

export interface SchedulingRequest {
  userId: string;
  socialAccountId: string;
  platform: Platform;
  preferredDate?: Date;        // target date (defaults to next available)
  timezone: string;            // user's timezone, e.g. "America/New_York"
  count?: number;              // number of slots to return (default 3)
  excludeSlots?: Date[];       // times to avoid
}

/**
 * Smart scheduling engine that determines optimal posting times
 * by analyzing historical engagement data, applying platform-specific rules,
 * and managing timezone conversions.
 */
export class SmartScheduler {
  /**
   * Analyzes historical engagement data to update optimal posting times
   * for a given social account. Should be run periodically (e.g., daily).
   */
  async analyzeEngagement(socialAccountId: string, platform: Platform): Promise<void> {
    // Fetch historical post analytics for this account
    const schedules = await prisma.postSchedule.findMany({
      where: {
        socialAccountId,
        platform,
        status: 'posted',
        postedAt: { not: null },
      },
      include: {
        analytics: {
          orderBy: { fetchedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { postedAt: 'desc' },
      take: 200, // analyze last 200 posts
    });

    if (schedules.length < 5) return; // not enough data

    // Group posts by day+hour and calculate average engagement
    const slotEngagement: Record<string, { totalScore: number; count: number }> = {};

    for (const schedule of schedules) {
      if (!schedule.postedAt || !schedule.analytics[0]) continue;

      const postedDate = new Date(schedule.postedAt);
      const dayOfWeek = postedDate.getUTCDay();
      const hourUtc = postedDate.getUTCHours();
      const key = `${dayOfWeek}:${hourUtc}`;

      const analytics = schedule.analytics[0];
      // Weighted engagement score
      const engagementScore =
        analytics.likes * 1 +
        analytics.comments * 3 +
        analytics.shares * 5 +
        analytics.saves * 4 +
        analytics.clicks * 2;

      // Normalize by reach (if available) for fair comparison
      const normalizedScore = analytics.reach > 0
        ? engagementScore / analytics.reach
        : engagementScore;

      if (!slotEngagement[key]) {
        slotEngagement[key] = { totalScore: 0, count: 0 };
      }
      slotEngagement[key].totalScore += normalizedScore;
      slotEngagement[key].count += 1;
    }

    // Upsert optimal posting times
    const upserts = Object.entries(slotEngagement).map(([key, data]) => {
      const [dayStr, hourStr] = key.split(':');
      const dayOfWeek = parseInt(dayStr, 10);
      const hourUtc = parseInt(hourStr, 10);
      const avgScore = data.totalScore / data.count;

      return prisma.optimalPostingTime.upsert({
        where: {
          socialAccountId_platform_dayOfWeek_hourUtc: {
            socialAccountId,
            platform,
            dayOfWeek,
            hourUtc,
          },
        },
        update: {
          score: avgScore,
          sampleSize: data.count,
        },
        create: {
          socialAccountId,
          platform,
          dayOfWeek,
          hourUtc,
          score: avgScore,
          sampleSize: data.count,
        },
      });
    });

    await Promise.all(upserts);
  }

  /**
   * Gets the best times to post, using historical data if available,
   * falling back to industry defaults for new accounts.
   */
  async getOptimalSlots(request: SchedulingRequest): Promise<OptimalSlot[]> {
    const { socialAccountId, platform, timezone, count = 3, excludeSlots = [] } = request;

    // Check for data-driven optimal times
    const storedTimes = await prisma.optimalPostingTime.findMany({
      where: { socialAccountId, platform },
      orderBy: { score: 'desc' },
    });

    const hasData = storedTimes.length >= 5;

    // Build scored time slots for the next 7 days
    const targetDate = request.preferredDate || new Date();
    const candidates: OptimalSlot[] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(targetDate);
      date.setDate(date.getDate() + dayOffset);

      for (let hour = 0; hour < 24; hour++) {
        const slotDate = new Date(date);
        slotDate.setUTCHours(hour, 0, 0, 0);

        // Skip past times
        if (slotDate.getTime() <= Date.now()) continue;

        // Skip excluded slots (within 30 min of any exclude)
        const isExcluded = excludeSlots.some(
          (ex) => Math.abs(ex.getTime() - slotDate.getTime()) < 30 * 60 * 1000
        );
        if (isExcluded) continue;

        const dayOfWeek = slotDate.getUTCDay();
        let score: number;
        let isDefault: boolean;

        if (hasData) {
          const stored = storedTimes.find(
            (t) => t.dayOfWeek === dayOfWeek && t.hourUtc === hour
          );
          score = stored?.score ?? 0.1;
          isDefault = false;
        } else {
          const defaults = DEFAULT_OPTIMAL_TIMES[platform];
          score = defaults?.[dayOfWeek]?.[hour] ?? 0;
          isDefault = true;
        }

        if (score > 0) {
          candidates.push({ scheduledAt: slotDate, score, isDefault });
        }
      }
    }

    // Check conflicts with existing scheduled posts
    const conflictFree = await this.filterConflicts(
      candidates,
      socialAccountId,
      platform
    );

    // Sort by score descending, return top N
    conflictFree.sort((a, b) => b.score - a.score);
    return conflictFree.slice(0, count);
  }

  /**
   * Resolves scheduling conflicts: minimum intervals and daily limits.
   */
  private async filterConflicts(
    candidates: OptimalSlot[],
    socialAccountId: string,
    platform: Platform
  ): Promise<OptimalSlot[]> {
    const minInterval = MIN_POSTING_INTERVALS[platform] * 60 * 1000;
    const dailyLimit = DAILY_POST_LIMITS[platform];

    // Fetch existing scheduled posts for this account in the next 7 days
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const existingSchedules = await prisma.postSchedule.findMany({
      where: {
        socialAccountId,
        platform,
        status: { in: ['scheduled', 'queued', 'posting'] },
        scheduledAt: { gte: now, lte: weekLater },
      },
      select: { scheduledAt: true },
    });

    const existingTimes = existingSchedules.map((s) => s.scheduledAt.getTime());

    // Count posts per day
    const postsPerDay: Record<string, number> = {};
    for (const s of existingSchedules) {
      const dayKey = s.scheduledAt.toISOString().slice(0, 10);
      postsPerDay[dayKey] = (postsPerDay[dayKey] || 0) + 1;
    }

    return candidates.filter((candidate) => {
      const t = candidate.scheduledAt.getTime();

      // Check minimum interval
      const tooClose = existingTimes.some(
        (existing) => Math.abs(existing - t) < minInterval
      );
      if (tooClose) return false;

      // Check daily limit
      const dayKey = candidate.scheduledAt.toISOString().slice(0, 10);
      if ((postsPerDay[dayKey] || 0) >= dailyLimit) return false;

      return true;
    });
  }

  /**
   * Converts a UTC time to the user's local timezone for display,
   * and from user's local time to UTC for storage.
   */
  toUserTime(utcDate: Date, timezone: string): string {
    return utcDate.toLocaleString('en-US', { timeZone: timezone });
  }

  toUtc(localDateStr: string, timezone: string): Date {
    // Parse as local time in the given timezone
    const date = new Date(localDateStr);
    const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
    const localStr = date.toLocaleString('en-US', { timeZone: timezone });
    const diff = new Date(localStr).getTime() - new Date(utcStr).getTime();
    return new Date(date.getTime() - diff);
  }

  /**
   * Validates that a proposed schedule doesn't violate platform rules.
   */
  async validateSchedule(
    socialAccountId: string,
    platform: Platform,
    scheduledAt: Date
  ): Promise<{ valid: boolean; reason?: string }> {
    if (scheduledAt.getTime() <= Date.now()) {
      return { valid: false, reason: 'Scheduled time must be in the future' };
    }

    const minInterval = MIN_POSTING_INTERVALS[platform] * 60 * 1000;
    const dailyLimit = DAILY_POST_LIMITS[platform];

    // Check interval conflict
    const windowStart = new Date(scheduledAt.getTime() - minInterval);
    const windowEnd = new Date(scheduledAt.getTime() + minInterval);

    const conflicting = await prisma.postSchedule.count({
      where: {
        socialAccountId,
        platform,
        status: { in: ['scheduled', 'queued', 'posting'] },
        scheduledAt: { gte: windowStart, lte: windowEnd },
      },
    });

    if (conflicting > 0) {
      return {
        valid: false,
        reason: `Must wait at least ${MIN_POSTING_INTERVALS[platform]} minutes between posts on ${platform}`,
      };
    }

    // Check daily limit
    const dayStart = new Date(scheduledAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledAt);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const dailyCount = await prisma.postSchedule.count({
      where: {
        socialAccountId,
        platform,
        status: { in: ['scheduled', 'queued', 'posting', 'posted'] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
    });

    if (dailyCount >= dailyLimit) {
      return {
        valid: false,
        reason: `Daily limit of ${dailyLimit} posts on ${platform} reached`,
      };
    }

    return { valid: true };
  }
}

export const smartScheduler = new SmartScheduler();
