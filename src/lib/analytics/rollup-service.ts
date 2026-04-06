import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@/lib/prisma';

const QUEUE_NAME = 'analytics-rollup';

export type RollupPeriod = 'daily' | 'weekly' | 'monthly';

interface RollupJobData {
  userId: string;
  period: RollupPeriod;
  periodStart: string; // ISO date
  periodEnd: string;
  businessId?: string;
}

export class RollupService {
  private queue: Queue;
  private worker: Worker | null = null;
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
    this.queue = new Queue(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    });
  }

  start(): void {
    this.worker = new Worker<RollupJobData>(
      QUEUE_NAME,
      async (job: Job<RollupJobData>) => {
        await this.computeRollup(job.data);
      },
      { connection: this.redis, concurrency: 2 }
    );
  }

  async scheduleRollups(userId: string, businessId?: string): Promise<number> {
    const now = new Date();
    const jobs: RollupJobData[] = [];

    // Daily rollup for yesterday
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setUTCHours(23, 59, 59, 999);

    jobs.push({
      userId,
      period: 'daily',
      periodStart: yesterday.toISOString(),
      periodEnd: yesterdayEnd.toISOString(),
      businessId,
    });

    // Weekly rollup (last 7 days ending yesterday)
    const weekStart = new Date(yesterday);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    jobs.push({
      userId,
      period: 'weekly',
      periodStart: weekStart.toISOString(),
      periodEnd: yesterdayEnd.toISOString(),
      businessId,
    });

    // Monthly rollup (if first day of month, rollup previous month)
    if (now.getUTCDate() === 1) {
      const monthStart = new Date(yesterday);
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      jobs.push({
        userId,
        period: 'monthly',
        periodStart: monthStart.toISOString(),
        periodEnd: yesterdayEnd.toISOString(),
        businessId,
      });
    }

    for (const job of jobs) {
      await this.queue.add('compute-rollup', job, {
        jobId: `rollup:${job.userId}:${job.period}:${job.periodStart}`,
      });
    }

    return jobs.length;
  }

  async computeRollup(data: RollupJobData): Promise<void> {
    const { userId, period, periodStart, periodEnd, businessId } = data;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    // Get all posted schedules in the period
    const postWhere: Record<string, unknown> = { userId };
    if (businessId) postWhere.businessId = businessId;

    const schedules = await prisma.postSchedule.findMany({
      where: {
        post: postWhere,
        scheduledAt: { gte: start, lte: end },
        status: { in: ['posted', 'posting'] },
      },
      include: {
        post: { select: { contentType: true } },
        socialAccount: { select: { platform: true, followerCount: true } },
        analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
    });

    // Get unique platforms
    const platformSet = new Set(schedules.map(s => s.socialAccount.platform));
    const platforms = Array.from(platformSet);

    // Compute per-platform and aggregate rollups
    for (const platform of [...platforms, null]) {
      const filtered = platform
        ? schedules.filter(s => s.socialAccount.platform === platform)
        : schedules;

      let impressions = 0, reach = 0, engagements = 0;
      let likes = 0, comments = 0, shares = 0, saves = 0, clicks = 0;
      const contentBreakdown: Record<string, number> = {};
      const hourlyEngagement: Record<string, number> = {};

      for (const schedule of filtered) {
        const a = schedule.analytics[0];
        if (!a) continue;

        impressions += a.impressions;
        reach += a.reach;
        likes += a.likes;
        comments += a.comments;
        shares += a.shares;
        saves += a.saves;
        clicks += a.clicks;
        engagements += a.likes + a.comments + a.shares + a.saves;

        // Content type breakdown
        const ct = schedule.post.contentType;
        contentBreakdown[ct] = (contentBreakdown[ct] || 0) + 1;

        // Hourly engagement heatmap
        const hour = schedule.scheduledAt.getUTCHours().toString();
        const engScore = a.likes + a.comments + a.shares + a.saves;
        hourlyEngagement[hour] = (hourlyEngagement[hour] || 0) + engScore;
      }

      // Get follower data for this platform
      const accountWhere: Record<string, unknown> = { userId, isActive: true };
      if (platform) accountWhere.platform = platform;
      const accounts = await prisma.socialAccount.findMany({
        where: accountWhere,
        select: { followerCount: true },
      });
      const followerCount = accounts.reduce((sum, a) => sum + a.followerCount, 0);

      const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;

      await prisma.analyticsRollup.upsert({
        where: {
          userId_businessId_platform_period_periodStart: {
            userId,
            businessId: (businessId ?? null) as string,
            platform: (platform ?? null) as string,
            period,
            periodStart: start,
          },
        },
        create: {
          userId,
          businessId: businessId ?? undefined,
          platform: platform ?? undefined,
          period,
          periodStart: start,
          periodEnd: end,
          impressions,
          reach,
          engagements,
          likes,
          comments,
          shares,
          saves,
          clicks,
          followerCount,
          followerGrowth: 0,
          postCount: filtered.length,
          engagementRate,
          contentBreakdown,
          hourlyEngagement,
        },
        update: {
          periodEnd: end,
          impressions,
          reach,
          engagements,
          likes,
          comments,
          shares,
          saves,
          clicks,
          followerCount,
          postCount: filtered.length,
          engagementRate,
          contentBreakdown,
          hourlyEngagement,
        },
      });
    }
  }

  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
  }
}
