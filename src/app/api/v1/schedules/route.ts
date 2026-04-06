import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { postLifecycle } from '@/lib/scheduling';
import { PlatformSchema } from '@/lib/social/types';
import { z } from 'zod';

const schedulePostSchema = z.object({
  postId: z.string().uuid(),
  timezone: z.string().default('UTC'),
  platforms: z.array(z.object({
    socialAccountId: z.string().uuid(),
    platform: PlatformSchema,
    scheduledAt: z.string().datetime(),
  })).min(1, 'At least one platform schedule is required'),
});

// POST /api/v1/schedules - Schedule a post to one or more platforms
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = schedulePostSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { postId, timezone, platforms } = result.data;

    // Verify post ownership
    const post = await prisma.post.findFirst({
      where: { id: postId, userId: user.sub },
    });
    if (!post) throw Errors.notFound('Post');

    if (!['draft', 'failed'].includes(post.status)) {
      throw Errors.badRequest(`Cannot schedule a post in "${post.status}" status`);
    }

    // Verify social account ownership
    const accountIds = Array.from(new Set(platforms.map((p) => p.socialAccountId)));
    const accounts = await prisma.socialAccount.findMany({
      where: { id: { in: accountIds }, userId: user.sub, isActive: true },
    });
    if (accounts.length !== accountIds.length) {
      throw Errors.badRequest('One or more social accounts not found or inactive');
    }

    const scheduled = await postLifecycle.schedulePost({
      postId,
      userId: user.sub,
      platforms: platforms.map((p) => ({
        ...p,
        scheduledAt: new Date(p.scheduledAt),
      })),
      timezone,
    });

    return NextResponse.json({ data: scheduled }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /api/v1/schedules - List user's schedules with filters
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const postId = searchParams.get('postId');
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 100);

    const where: Record<string, unknown> = {
      post: { userId: user.sub },
    };
    if (postId) where.postId = postId;
    if (platform) where.platform = platform;
    if (status) where.status = status;
    if (from || to) {
      where.scheduledAt = {};
      if (from) (where.scheduledAt as Record<string, unknown>).gte = new Date(from);
      if (to) (where.scheduledAt as Record<string, unknown>).lte = new Date(to);
    }

    const [schedules, total] = await Promise.all([
      prisma.postSchedule.findMany({
        where,
        include: {
          post: {
            select: { id: true, contentText: true, contentType: true, status: true },
          },
          socialAccount: {
            select: { id: true, platform: true, accountName: true, accountHandle: true },
          },
        },
        orderBy: { scheduledAt: 'asc' },
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
