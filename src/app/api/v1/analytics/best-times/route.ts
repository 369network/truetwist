export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';

// GET /api/v1/analytics/best-times - Heatmap data of engagement by hour/day
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const platform = searchParams.get('platform');
    const range = searchParams.get('range') || '90d';

    const days = { '30d': 30, '90d': 90, '180d': 180 }[range] || 90;
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
      select: {
        scheduledAt: true,
        analytics: {
          select: { likes: true, comments: true, shares: true, saves: true, impressions: true },
          orderBy: { fetchedAt: 'desc' },
          take: 1,
        },
      },
    });

    // Build heatmap: day of week (0-6) x hour (0-23)
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const counts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    for (const s of schedules) {
      const a = s.analytics[0];
      if (!a) continue;
      const day = s.scheduledAt.getUTCDay();
      const hour = s.scheduledAt.getUTCHours();
      const engagement = a.likes + a.comments + a.shares + a.saves;
      const rate = a.impressions > 0 ? engagement / a.impressions : 0;
      heatmap[day][hour] += rate;
      counts[day][hour]++;
    }

    // Average the rates
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const result: Array<{ day: string; dayIndex: number; hour: number; avgEngagementRate: number; postCount: number }> = [];

    let bestDay = 0, bestHour = 0, bestRate = 0;

    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const avg = counts[d][h] > 0 ? heatmap[d][h] / counts[d][h] * 100 : 0;
        result.push({
          day: dayNames[d],
          dayIndex: d,
          hour: h,
          avgEngagementRate: Number(avg.toFixed(2)),
          postCount: counts[d][h],
        });
        if (avg > bestRate) {
          bestRate = avg;
          bestDay = d;
          bestHour = h;
        }
      }
    }

    // Pull optimal posting times — fetch account IDs separately to avoid inline subquery
    const activeAccountIds = (await prisma.socialAccount.findMany({
      where: { userId: user.sub, isActive: true },
      select: { id: true },
    })).map(a => a.id);

    const optimalTimes = activeAccountIds.length > 0
      ? await prisma.optimalPostingTime.findMany({
          where: {
            socialAccountId: { in: activeAccountIds },
            ...(platform ? { platform } : {}),
          },
          orderBy: { score: 'desc' },
          take: 10,
        })
      : [];

    return NextResponse.json({
      data: {
        heatmap: result,
        bestTime: {
          day: dayNames[bestDay],
          dayIndex: bestDay,
          hour: bestHour,
          avgEngagementRate: Number(bestRate.toFixed(2)),
        },
        optimalTimes: optimalTimes.map(t => ({
          platform: t.platform,
          dayOfWeek: t.dayOfWeek,
          day: dayNames[t.dayOfWeek],
          hour: t.hourUtc,
          score: t.score,
          sampleSize: t.sampleSize,
        })),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
