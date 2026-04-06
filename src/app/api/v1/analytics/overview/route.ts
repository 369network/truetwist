import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';

// GET /api/v1/analytics/overview - Cross-platform overview
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const range = searchParams.get('range') || '30d';

    const days = { '7d': 7, '30d': 30, '90d': 90 }[range] || 30;
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 86400000);

    const postWhere: Record<string, unknown> = { userId: user.sub };
    if (businessId) postWhere.businessId = businessId;

    const schedules = await prisma.postSchedule.findMany({
      where: {
        post: postWhere,
        scheduledAt: { gte: startDate },
        status: { in: ['posted', 'posting'] },
      },
      include: {
        socialAccount: { select: { platform: true, followerCount: true } },
        analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
    });

    let totalImpressions = 0, totalReach = 0, totalEngagements = 0, totalClicks = 0;

    for (const s of schedules) {
      const a = s.analytics[0];
      if (!a) continue;
      totalImpressions += a.impressions;
      totalReach += a.reach;
      totalEngagements += a.likes + a.comments + a.shares + a.saves;
      totalClicks += a.clicks;
    }

    const accounts = await prisma.socialAccount.findMany({
      where: { userId: user.sub, isActive: true },
      select: { followerCount: true },
    });
    const totalFollowers = accounts.reduce((sum, a) => sum + a.followerCount, 0);

    // Get previous period for comparison
    const prevStart = new Date(startDate.getTime() - days * 86400000);
    const prevSchedules = await prisma.postSchedule.findMany({
      where: {
        post: postWhere,
        scheduledAt: { gte: prevStart, lt: startDate },
        status: { in: ['posted', 'posting'] },
      },
      include: { analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 } },
    });

    let prevImpressions = 0, prevEngagements = 0;
    for (const s of prevSchedules) {
      const a = s.analytics[0];
      if (!a) continue;
      prevImpressions += a.impressions;
      prevEngagements += a.likes + a.comments + a.shares + a.saves;
    }

    const engagementRate = totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;
    const prevEngagementRate = prevImpressions > 0 ? (prevEngagements / prevImpressions) * 100 : 0;

    return NextResponse.json({
      data: {
        totalImpressions,
        totalReach,
        totalEngagements,
        totalFollowers,
        totalClicks,
        engagementRate: Number(engagementRate.toFixed(2)),
        postCount: schedules.length,
        changes: {
          impressions: calcChange(totalImpressions, prevImpressions),
          engagements: calcChange(totalEngagements, prevEngagements),
          engagementRate: calcChange(engagementRate, prevEngagementRate),
        },
        dateRange: { start: startDate.toISOString(), end: now.toISOString(), days },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number(((current - previous) / previous * 100).toFixed(1));
}
