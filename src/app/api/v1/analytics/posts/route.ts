export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';

// GET /api/v1/analytics/posts - Ranked post performance
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const range = searchParams.get('range') || '30d';
    const sortBy = searchParams.get('sortBy') || 'engagementRate'; // engagementRate, reach, impressions
    const platform = searchParams.get('platform');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);

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
        post: { select: { id: true, contentText: true, contentType: true, aiGenerated: true, viralScore: true } },
        socialAccount: { select: { platform: true, accountName: true } },
        analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
    });

    const posts = schedules
      .filter(s => s.analytics[0])
      .map(s => {
        const a = s.analytics[0];
        return {
          postId: s.post.id,
          scheduleId: s.id,
          content: s.post.contentText?.slice(0, 120) || 'Untitled',
          contentType: s.post.contentType,
          platform: s.socialAccount.platform,
          account: s.socialAccount.accountName,
          aiGenerated: s.post.aiGenerated,
          viralScore: s.post.viralScore,
          postedAt: s.scheduledAt.toISOString(),
          platformPostUrl: s.platformPostUrl,
          impressions: a.impressions,
          reach: a.reach,
          likes: a.likes,
          comments: a.comments,
          shares: a.shares,
          saves: a.saves,
          clicks: a.clicks,
          engagementRate: a.engagementRate,
        };
      });

    // Sort
    posts.sort((a, b) => {
      const key = sortBy as keyof typeof a;
      return (Number(b[key]) || 0) - (Number(a[key]) || 0);
    });

    // Paginate
    const total = posts.length;
    const paginated = posts.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      data: paginated,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
