export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiKeyUser, requireScope } from '@/middleware/api-key';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/public/analytics - Read engagement metrics and growth data
export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'read');

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';
    const platform = searchParams.get('platform');
    const businessId = searchParams.get('businessId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      throw Errors.validation({ period: 'Must be daily, weekly, or monthly' });
    }

    const where: Record<string, unknown> = {
      userId: apiUser.sub,
      period,
    };

    if (platform) where.platform = platform;
    if (businessId) where.businessId = businessId;

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.periodStart = dateFilter;
    }

    const rollups = await prisma.analyticsRollup.findMany({
      where,
      orderBy: { periodStart: 'desc' },
      take: 90,
    });

    // Also fetch recent post analytics for granular data
    const postAnalytics = await prisma.postAnalytics.findMany({
      where: {
        postSchedule: {
          post: { userId: apiUser.sub },
          ...(platform ? { platform } : {}),
        },
      },
      include: {
        postSchedule: {
          select: {
            platform: true,
            postedAt: true,
            post: { select: { id: true, contentText: true } },
          },
        },
      },
      orderBy: { fetchedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      data: {
        rollups,
        recentPosts: postAnalytics,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
