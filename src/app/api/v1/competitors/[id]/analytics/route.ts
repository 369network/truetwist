import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { detectTrend } from '@/lib/competitors/analysis-engine';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/competitors/:id/analytics
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = getAuthUser(request);
    const { id } = await params;

    const competitor = await prisma.competitor.findUnique({
      where: { id },
      include: {
        business: { select: { userId: true } },
        accounts: {
          include: {
            snapshots: {
              orderBy: { snapshotAt: 'desc' },
              take: 30,
            },
            posts: {
              orderBy: { postedAt: 'desc' },
              take: 10,
              select: {
                id: true,
                contentType: true,
                likes: true,
                comments: true,
                shares: true,
                saves: true,
                engagementRate: true,
                isViral: true,
                postedAt: true,
              },
            },
          },
        },
      },
    });

    if (!competitor || competitor.business.userId !== auth.sub) {
      throw Errors.notFound('Competitor');
    }

    // Build analytics response per account
    const accountAnalytics = await Promise.all(
      competitor.accounts.map(async (account) => {
        const followerTrend = await detectTrend(account.id, 'followerCount');
        const engagementTrend = await detectTrend(account.id, 'engagementRate');

        return {
          accountId: account.id,
          platform: account.platform,
          handle: account.handle,
          currentMetrics: {
            followerCount: account.followerCount,
            followingCount: account.followingCount,
            postCount: account.postCount,
            engagementRate: account.engagementRate,
            avgLikes: account.avgLikes,
            avgComments: account.avgComments,
            postingFrequency: account.postingFrequency,
          },
          trends: {
            followerTrend,
            engagementTrend,
          },
          contentBreakdown: account.contentMix,
          topHashtags: account.topHashtags,
          peakPostingHours: account.peakPostingHours,
          recentPosts: account.posts,
          followerHistory: account.snapshots.map(s => ({
            date: s.snapshotAt,
            followers: s.followerCount,
            engagementRate: s.engagementRate,
          })),
        };
      })
    );

    const { business, ...competitorData } = competitor;
    return NextResponse.json({
      data: {
        competitor: {
          id: competitorData.id,
          name: competitorData.name,
          websiteUrl: competitorData.websiteUrl,
        },
        accounts: accountAnalytics,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
