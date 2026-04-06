import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { z } from 'zod';

const schedulePostSchema = z.object({
  socialAccountId: z.string().uuid(),
  platform: z.string(),
  scheduledAt: z.string().datetime(),
});

const rescheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
});

// POST /api/v1/posts/:id/schedule - Schedule a post to a platform
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = schedulePostSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const post = await prisma.post.findFirst({
      where: { id: params.id, userId: user.sub },
    });

    if (!post) throw Errors.notFound('Post');

    // Verify the social account belongs to the user
    const account = await prisma.socialAccount.findFirst({
      where: { id: result.data.socialAccountId, userId: user.sub },
    });

    if (!account) throw Errors.notFound('Social Account');

    const schedule = await prisma.postSchedule.create({
      data: {
        postId: params.id,
        socialAccountId: result.data.socialAccountId,
        platform: result.data.platform,
        scheduledAt: new Date(result.data.scheduledAt),
        status: 'scheduled',
      },
      include: {
        socialAccount: {
          select: { id: true, platform: true, accountName: true, accountHandle: true },
        },
      },
    });

    // Update post status to scheduled if it was a draft
    if (post.status === 'draft') {
      await prisma.post.update({
        where: { id: params.id },
        data: { status: 'scheduled' },
      });
    }

    return NextResponse.json({ data: schedule }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/posts/:id/schedule - Reschedule (drag-and-drop support)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const { scheduleId } = body;
    const result = rescheduleSchema.safeParse(body);

    if (!result.success || !scheduleId) {
      throw Errors.validation(result.success ? { scheduleId: ['Required'] } : result.error.flatten().fieldErrors);
    }

    // Verify ownership
    const schedule = await prisma.postSchedule.findFirst({
      where: { id: scheduleId, post: { userId: user.sub } },
    });

    if (!schedule) throw Errors.notFound('Schedule');
    if (schedule.status === 'posted' || schedule.status === 'posting') {
      throw Errors.badRequest('Cannot reschedule a post that is already posted or posting');
    }

    const updated = await prisma.postSchedule.update({
      where: { id: scheduleId },
      data: { scheduledAt: new Date(result.data.scheduledAt) },
      include: {
        post: { select: { id: true, contentText: true, contentType: true } },
        socialAccount: { select: { id: true, platform: true, accountName: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
