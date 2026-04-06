export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/calendar?view=week|month|day&date=2026-04-05&businessId=...&platform=...
// Also supports legacy params: start=...&end=...
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const view = searchParams.get('view') || 'week';
    const businessId = searchParams.get('businessId');
    const platform = searchParams.get('platform');

    // Support both new view-based params and legacy start/end params
    let from: Date;
    let to: Date;

    const legacyStart = searchParams.get('start');
    const legacyEnd = searchParams.get('end');

    if (legacyStart || legacyEnd) {
      from = legacyStart ? new Date(legacyStart) : new Date();
      to = legacyEnd ? new Date(legacyEnd) : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10);
      const baseDate = new Date(dateStr);

      if (view === 'month') {
        from = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        to = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (view === 'day') {
        from = new Date(baseDate);
        from.setUTCHours(0, 0, 0, 0);
        to = new Date(baseDate);
        to.setUTCHours(23, 59, 59, 999);
      } else {
        // week: Mon-Sun containing the given date
        const dayOfWeek = baseDate.getUTCDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        from = new Date(baseDate);
        from.setUTCDate(from.getUTCDate() + mondayOffset);
        from.setUTCHours(0, 0, 0, 0);
        to = new Date(from);
        to.setUTCDate(to.getUTCDate() + 6);
        to.setUTCHours(23, 59, 59, 999);
      }
    }

    const where: Record<string, unknown> = {
      post: {
        userId: user.sub,
        ...(businessId ? { businessId } : {}),
      },
      scheduledAt: { gte: from, lte: to },
    };
    if (platform) where.platform = platform;

    const schedules = await prisma.postSchedule.findMany({
      where,
      include: {
        post: {
          select: {
            id: true,
            contentText: true,
            contentType: true,
            status: true,
            business: { select: { id: true, name: true } },
            media: {
              select: { id: true, mediaType: true, mediaUrl: true, thumbnailUrl: true },
              take: 1,
            },
          },
        },
        socialAccount: {
          select: { id: true, platform: true, accountName: true, accountHandle: true },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Group by date for calendar display
    const grouped: Record<string, typeof schedules> = {};
    for (const schedule of schedules) {
      const dateKey = schedule.scheduledAt.toISOString().slice(0, 10);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(schedule);
    }

    // Build day summaries
    const days = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const daySchedules = grouped[dateKey] || [];
      days.push({
        date: dateKey,
        totalPosts: daySchedules.length,
        platforms: Array.from(new Set(daySchedules.map((s) => s.platform))),
        schedules: daySchedules.map((s) => ({
          id: s.id,
          postId: s.post.id,
          title: s.post.contentText?.slice(0, 60) || 'Untitled',
          contentType: s.post.contentType,
          platform: s.socialAccount.platform,
          accountName: s.socialAccount.accountName,
          accountHandle: s.socialAccount.accountHandle,
          scheduledAt: s.scheduledAt.toISOString(),
          postedAt: s.postedAt?.toISOString() || null,
          status: s.status,
          crossPostGroup: s.crossPostGroup,
          businessName: s.post.business?.name,
          thumbnailUrl: s.post.media[0]?.thumbnailUrl || s.post.media[0]?.mediaUrl || null,
        })),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return NextResponse.json({
      data: {
        view,
        from: from.toISOString(),
        to: to.toISOString(),
        totalSchedules: schedules.length,
        days,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
