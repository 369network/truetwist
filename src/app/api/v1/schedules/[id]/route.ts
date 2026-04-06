import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { postLifecycle } from '@/lib/scheduling';
import { z } from 'zod';

const rescheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
});

// GET /api/v1/schedules/:id - Get schedule details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);

    const schedule = await prisma.postSchedule.findFirst({
      where: { id: params.id, post: { userId: user.sub } },
      include: {
        post: {
          select: { id: true, contentText: true, contentType: true, status: true },
        },
        socialAccount: {
          select: { id: true, platform: true, accountName: true, accountHandle: true },
        },
        analytics: {
          orderBy: { fetchedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!schedule) throw Errors.notFound('Schedule');

    // Include cross-post siblings if part of a group
    let crossPostSiblings = null;
    if (schedule.crossPostGroup) {
      crossPostSiblings = await postLifecycle.getCrossPostStatus(schedule.crossPostGroup);
    }

    return NextResponse.json({ data: { ...schedule, crossPostSiblings } });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/schedules/:id - Reschedule (drag-and-drop support)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = rescheduleSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    // Verify ownership
    const schedule = await prisma.postSchedule.findFirst({
      where: { id: params.id, post: { userId: user.sub } },
    });
    if (!schedule) throw Errors.notFound('Schedule');

    await postLifecycle.reschedulePost(params.id, new Date(result.data.scheduledAt));

    const updated = await prisma.postSchedule.findUnique({
      where: { id: params.id },
      include: {
        post: { select: { id: true, contentText: true, contentType: true, status: true } },
        socialAccount: {
          select: { id: true, platform: true, accountName: true, accountHandle: true },
        },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/schedules/:id - Cancel a schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);

    const schedule = await prisma.postSchedule.findFirst({
      where: { id: params.id, post: { userId: user.sub } },
    });
    if (!schedule) throw Errors.notFound('Schedule');

    await postLifecycle.cancelSchedule(params.id);

    return NextResponse.json({ data: { message: 'Schedule cancelled.' } });
  } catch (error) {
    return errorResponse(error);
  }
}
