import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';

// GET /api/v1/analytics/growth - Growth metrics with time series
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const range = searchParams.get('range') || '30d';
    const platform = searchParams.get('platform');

    const days = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 }[range] || 30;
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 86400000);

    // Try to use rollups first for longer ranges
    if (days >= 30) {
      const period = days >= 90 ? 'monthly' : 'weekly';
      const rollupWhere: Record<string, unknown> = {
        userId: user.sub,
        period,
        periodStart: { gte: startDate },
      };
      if (businessId) rollupWhere.businessId = businessId;
      if (platform) rollupWhere.platform = platform;
      else rollupWhere.platform = null; // cross-platform aggregate

      const rollups = await prisma.analyticsRollup.findMany({
        where: rollupWhere,
        orderBy: { periodStart: 'asc' },
      });

      if (rollups.length > 0) {
        return NextResponse.json({
          data: {
            series: rollups.map(r => ({
              period: r.periodStart.toISOString().slice(0, 10),
              impressions: r.impressions,
              reach: r.reach,
              engagements: r.engagements,
              followerCount: r.followerCount,
              followerGrowth: r.followerGrowth,
              postCount: r.postCount,
              engagementRate: Number(r.engagementRate.toFixed(2)),
            })),
            source: 'rollup',
          },
        });
      }
    }

    // Fallback: compute from raw analytics
    const postWhere: Record<string, unknown> = { userId: user.sub };
    if (businessId) postWhere.businessId = businessId;

    const scheduleWhere: Record<string, unknown> = {
      post: postWhere,
      scheduledAt: { gte: startDate },
      status: { in: ['posted', 'posting'] },
    };
    if (platform) scheduleWhere.socialAccount = { platform };

    const schedules = await prisma.postSchedule.findMany({
      where: scheduleWhere,
      include: {
        analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Bucket by day or week
    const bucketSize = days <= 14 ? 'day' : days <= 60 ? 'week' : 'month';
    const buckets: Record<string, { impressions: number; reach: number; engagements: number; posts: number }> = {};

    for (const s of schedules) {
      const a = s.analytics[0];
      if (!a) continue;
      const key = getBucketKey(s.scheduledAt, bucketSize);
      if (!buckets[key]) buckets[key] = { impressions: 0, reach: 0, engagements: 0, posts: 0 };
      buckets[key].impressions += a.impressions;
      buckets[key].reach += a.reach;
      buckets[key].engagements += a.likes + a.comments + a.shares + a.saves;
      buckets[key].posts++;
    }

    const series = Object.entries(buckets).map(([period, d]) => ({
      period,
      impressions: d.impressions,
      reach: d.reach,
      engagements: d.engagements,
      postCount: d.posts,
      engagementRate: d.impressions > 0 ? Number(((d.engagements / d.impressions) * 100).toFixed(2)) : 0,
    }));

    return NextResponse.json({ data: { series, source: 'computed' } });
  } catch (error) {
    return errorResponse(error);
  }
}

function getBucketKey(date: Date, size: string): string {
  if (size === 'day') return date.toISOString().slice(0, 10);
  if (size === 'week') {
    const d = new Date(date);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day); // Start of week (Sunday)
    return d.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 7); // month
}
