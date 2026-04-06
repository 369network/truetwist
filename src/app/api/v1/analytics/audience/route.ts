import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';

// GET /api/v1/analytics/audience - Audience insights (demographics, active hours, growth sources)
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');

    // Get social accounts with their metrics
    const accountWhere: Record<string, unknown> = { userId: user.sub, isActive: true };
    if (platform) accountWhere.platform = platform;

    const accounts = await prisma.socialAccount.findMany({
      where: accountWhere,
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountHandle: true,
        followerCount: true,
      },
    });

    // Calculate follower growth from recent analytics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

    // Get post engagement patterns to infer active hours
    const schedules = await prisma.postSchedule.findMany({
      where: {
        post: { userId: user.sub },
        scheduledAt: { gte: thirtyDaysAgo },
        status: { in: ['posted', 'posting'] },
        ...(platform ? { socialAccount: { platform } } : {}),
      },
      include: {
        socialAccount: { select: { platform: true } },
        analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
    });

    // Infer active hours from best engagement times
    const hourlyActivity: Record<number, { engagements: number; count: number }> = {};
    for (const s of schedules) {
      const a = s.analytics[0];
      if (!a) continue;
      const hour = s.scheduledAt.getUTCHours();
      if (!hourlyActivity[hour]) hourlyActivity[hour] = { engagements: 0, count: 0 };
      hourlyActivity[hour].engagements += a.likes + a.comments + a.shares + a.saves;
      hourlyActivity[hour].count++;
    }

    const activeHours = Object.entries(hourlyActivity)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        avgEngagement: data.count > 0 ? Math.round(data.engagements / data.count) : 0,
        postCount: data.count,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    // Follower summary per platform
    const platformSummary = accounts.map(a => ({
      platform: a.platform,
      accountName: a.accountName,
      handle: a.accountHandle,
      followers: a.followerCount,
    }));

    const totalFollowers = accounts.reduce((sum, a) => sum + a.followerCount, 0);

    // Get rollup data for growth trend if available
    const rollups = await prisma.analyticsRollup.findMany({
      where: {
        userId: user.sub,
        platform: platform ?? null,
        period: 'weekly',
        periodStart: { gte: sixtyDaysAgo },
      },
      orderBy: { periodStart: 'asc' },
      select: { periodStart: true, followerCount: true, followerGrowth: true },
    });

    return NextResponse.json({
      data: {
        totalFollowers,
        platforms: platformSummary,
        activeHours: activeHours.slice(0, 10),
        growthTrend: rollups.map(r => ({
          date: r.periodStart.toISOString().slice(0, 10),
          followers: r.followerCount,
          growth: r.followerGrowth,
        })),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
