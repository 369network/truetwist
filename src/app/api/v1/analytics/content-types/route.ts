export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';

// GET /api/v1/analytics/content-types - Performance by content format
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const range = searchParams.get('range') || '30d';
    const platform = searchParams.get('platform');

    const days = { '7d': 7, '30d': 30, '90d': 90 }[range] || 30;
    const startDate = new Date(Date.now() - days * 86400000);

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
        post: { select: { contentType: true } },
        analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
    });

    const types: Record<string, {
      count: number; impressions: number; reach: number;
      engagements: number; likes: number; comments: number;
      shares: number; saves: number; avgEngagementRate: number;
    }> = {};

    for (const s of schedules) {
      const a = s.analytics[0];
      if (!a) continue;
      const ct = s.post.contentType;
      if (!types[ct]) {
        types[ct] = { count: 0, impressions: 0, reach: 0, engagements: 0, likes: 0, comments: 0, shares: 0, saves: 0, avgEngagementRate: 0 };
      }
      types[ct].count++;
      types[ct].impressions += a.impressions;
      types[ct].reach += a.reach;
      types[ct].likes += a.likes;
      types[ct].comments += a.comments;
      types[ct].shares += a.shares;
      types[ct].saves += a.saves;
      types[ct].engagements += a.likes + a.comments + a.shares + a.saves;
    }

    // Calculate avg engagement rates
    for (const t of Object.values(types)) {
      t.avgEngagementRate = t.impressions > 0 ? Number(((t.engagements / t.impressions) * 100).toFixed(2)) : 0;
    }

    // Sort by engagement rate
    const sorted = Object.entries(types)
      .map(([contentType, metrics]) => ({ contentType, ...metrics }))
      .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);

    return NextResponse.json({ data: { contentTypes: sorted } });
  } catch (error) {
    return errorResponse(error);
  }
}
