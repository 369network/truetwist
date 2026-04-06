export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiKeyUser, requireScope } from '@/middleware/api-key';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/public/schedules - List scheduled posts
export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'read');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20', 10), 100);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { post: { userId: apiUser.sub } };
    if (status) where.status = status;

    const [schedules, total] = await Promise.all([
      prisma.postSchedule.findMany({
        where,
        select: {
          id: true,
          postId: true,
          platform: true,
          scheduledAt: true,
          postedAt: true,
          status: true,
          platformPostUrl: true,
          createdAt: true,
        },
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.postSchedule.count({ where }),
    ]);

    return NextResponse.json({
      data: schedules,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/public/schedules - Schedule a post
export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'write');

    const body = await request.json();
    const { postId, socialAccountId, platform, scheduledAt } = body;

    if (!postId) throw Errors.validation({ postId: 'postId is required' });
    if (!socialAccountId) throw Errors.validation({ socialAccountId: 'socialAccountId is required' });
    if (!platform) throw Errors.validation({ platform: 'platform is required' });
    if (!scheduledAt) throw Errors.validation({ scheduledAt: 'scheduledAt is required (ISO 8601)' });

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw Errors.validation({ scheduledAt: 'Invalid date format' });
    }

    if (scheduledDate <= new Date()) {
      throw Errors.validation({ scheduledAt: 'scheduledAt must be in the future' });
    }

    // Verify post belongs to user
    const post = await prisma.post.findFirst({
      where: { id: postId, userId: apiUser.sub },
    });
    if (!post) throw Errors.notFound('Post');

    // Verify social account belongs to user
    const account = await prisma.socialAccount.findFirst({
      where: { id: socialAccountId, userId: apiUser.sub },
    });
    if (!account) throw Errors.notFound('Social account');

    const schedule = await prisma.postSchedule.create({
      data: {
        postId,
        socialAccountId,
        platform,
        scheduledAt: scheduledDate,
        status: 'scheduled',
      },
      select: {
        id: true,
        postId: true,
        platform: true,
        scheduledAt: true,
        status: true,
        createdAt: true,
      },
    });

    // Update post status
    await prisma.post.update({
      where: { id: postId },
      data: { status: 'scheduled' },
    });

    return NextResponse.json({ data: schedule }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
