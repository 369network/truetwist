export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';

// GET /api/v1/analytics - Get aggregated analytics
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const range = searchParams.get('range') || '30d';
    const businessId = searchParams.get('businessId');

    // Calculate date range
    const now = new Date();
    const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[range] || 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Build post filter
    const postWhere: Record<string, unknown> = { userId: user.sub };
    if (businessId) postWhere.businessId = businessId;

    // Fetch analytics for the user's posts in date range
    const schedules = await prisma.postSchedule.findMany({
      where: {
        post: postWhere,
        scheduledAt: { gte: startDate },
        status: { in: ['posted', 'posting'] },
      },
      include: {
        post: { select: { id: true, contentText: true, contentType: true } },
        socialAccount: { select: { platform: true, accountName: true } },
        analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    // Aggregate metrics
    let totalImpressions = 0;
    let totalEngagements = 0;
    let totalClicks = 0;
    let totalFollowers = 0;

    const platformMetrics: Record<string, {
      impressions: number; engagements: number; followers: number; posts: number;
    }> = {};

    const topPosts: Array<{
      title: string; platform: string;
      impressions: number; engagementRate: number;
      likes: number; comments: number; shares: number;
    }> = [];

    for (const schedule of schedules) {
      const analytics = schedule.analytics[0];
      if (!analytics) continue;

      totalImpressions += analytics.impressions;
      totalEngagements += analytics.likes + analytics.comments + analytics.shares + analytics.saves;
      totalClicks += analytics.clicks;

      const platform = schedule.socialAccount.platform;
      if (!platformMetrics[platform]) {
        platformMetrics[platform] = { impressions: 0, engagements: 0, followers: 0, posts: 0 };
      }
      platformMetrics[platform].impressions += analytics.impressions;
      platformMetrics[platform].engagements += analytics.likes + analytics.comments + analytics.shares;
      platformMetrics[platform].posts++;

      topPosts.push({
        title: schedule.post.contentText?.slice(0, 50) || 'Untitled Post',
        platform,
        impressions: analytics.impressions,
        engagementRate: analytics.engagementRate,
        likes: analytics.likes,
        comments: analytics.comments,
        shares: analytics.shares,
      });
    }

    // Get follower counts from social accounts
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { userId: user.sub, isActive: true },
      select: { platform: true, followerCount: true },
    });

    for (const account of socialAccounts) {
      totalFollowers += account.followerCount;
      if (platformMetrics[account.platform]) {
        platformMetrics[account.platform].followers = account.followerCount;
      }
    }

    // Sort top posts by engagement rate
    topPosts.sort((a, b) => b.engagementRate - a.engagementRate);

    // Build growth data (group by week/month depending on range)
    const growthData = await buildGrowthData(user.sub, startDate, now, days);

    return NextResponse.json({
      data: {
        summary: {
          totalImpressions,
          totalEngagements,
          totalFollowers,
          totalClicks,
          engagementRate: totalImpressions > 0
            ? ((totalEngagements / totalImpressions) * 100).toFixed(1)
            : '0.0',
        },
        platformMetrics,
        topPosts: topPosts.slice(0, 10),
        growthData,
        dateRange: { start: startDate.toISOString(), end: now.toISOString(), days },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function buildGrowthData(
  userId: string,
  startDate: Date,
  endDate: Date,
  days: number
) {
  // Group post analytics by time period
  const analytics = await prisma.postAnalytics.findMany({
    where: {
      postSchedule: {
        post: { userId },
        scheduledAt: { gte: startDate, lte: endDate },
      },
    },
    select: {
      impressions: true,
      likes: true,
      comments: true,
      shares: true,
      saves: true,
      engagementRate: true,
      fetchedAt: true,
    },
    orderBy: { fetchedAt: 'asc' },
  });

  // Group by period
  const buckets: Record<string, { impressions: number; engagements: number; count: number }> = {};

  for (const a of analytics) {
    const date = new Date(a.fetchedAt);
    const key = days <= 7
      ? date.toISOString().slice(0, 10) // daily
      : days <= 30
        ? `W${getWeekNumber(date)}` // weekly
        : date.toISOString().slice(0, 7); // monthly

    if (!buckets[key]) buckets[key] = { impressions: 0, engagements: 0, count: 0 };
    buckets[key].impressions += a.impressions;
    buckets[key].engagements += a.likes + a.comments + a.shares + a.saves;
    buckets[key].count++;
  }

  return Object.entries(buckets).map(([period, data]) => ({
    period,
    impressions: data.impressions,
    engagements: data.engagements,
    avgEngagementRate: data.count > 0 && data.impressions > 0
      ? ((data.engagements / data.impressions) * 100).toFixed(1)
      : '0.0',
  }));
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
