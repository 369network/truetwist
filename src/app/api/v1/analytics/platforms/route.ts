export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';

// GET /api/v1/analytics/platforms - Per-platform metrics comparison
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const range = searchParams.get('range') || '30d';

    const days = { '7d': 7, '30d': 30, '90d': 90 }[range] || 30;
    const startDate = new Date(Date.now() - days * 86400000);

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

    const platforms: Record<string, {
      impressions: number; reach: number; engagements: number;
      likes: number; comments: number; shares: number; saves: number;
      clicks: number; posts: number; followers: number; engagementRate: number;
    }> = {};

    for (const s of schedules) {
      const a = s.analytics[0];
      if (!a) continue;
      const p = s.socialAccount.platform;
      if (!platforms[p]) {
        platforms[p] = { impressions: 0, reach: 0, engagements: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, posts: 0, followers: 0, engagementRate: 0 };
      }
      platforms[p].impressions += a.impressions;
      platforms[p].reach += a.reach;
      platforms[p].likes += a.likes;
      platforms[p].comments += a.comments;
      platforms[p].shares += a.shares;
      platforms[p].saves += a.saves;
      platforms[p].clicks += a.clicks;
      platforms[p].engagements += a.likes + a.comments + a.shares + a.saves;
      platforms[p].posts++;
    }

    // Add follower counts
    const accounts = await prisma.socialAccount.findMany({
      where: { userId: user.sub, isActive: true },
      select: { platform: true, followerCount: true },
    });

    for (const account of accounts) {
      if (platforms[account.platform]) {
        platforms[account.platform].followers = account.followerCount;
      }
    }

    // Calculate engagement rates
    for (const p of Object.values(platforms)) {
      p.engagementRate = p.impressions > 0 ? Number(((p.engagements / p.impressions) * 100).toFixed(2)) : 0;
    }

    return NextResponse.json({ data: { platforms } });
  } catch (error) {
    return errorResponse(error);
  }
}
