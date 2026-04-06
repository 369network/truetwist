import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiKeyUser, requireScope } from '@/middleware/api-key';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/public/schedules/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'read');

    const schedule = await prisma.postSchedule.findFirst({
      where: { id: params.id, post: { userId: apiUser.sub } },
      include: {
        post: {
          select: { id: true, contentText: true, contentType: true },
        },
        analytics: true,
      },
    });

    if (!schedule) throw Errors.notFound('Schedule');

    return NextResponse.json({ data: schedule });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/public/schedules/:id - Update schedule time
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'write');

    const existing = await prisma.postSchedule.findFirst({
      where: { id: params.id, post: { userId: apiUser.sub } },
    });

    if (!existing) throw Errors.notFound('Schedule');

    if (!['draft', 'scheduled'].includes(existing.status)) {
      throw Errors.badRequest('Can only update draft or scheduled posts');
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.scheduledAt) {
      const date = new Date(body.scheduledAt);
      if (isNaN(date.getTime())) throw Errors.validation({ scheduledAt: 'Invalid date' });
      if (date <= new Date()) throw Errors.validation({ scheduledAt: 'Must be in the future' });
      updateData.scheduledAt = date;
    }

    const updated = await prisma.postSchedule.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/public/schedules/:id - Cancel a schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'write');

    const existing = await prisma.postSchedule.findFirst({
      where: { id: params.id, post: { userId: apiUser.sub } },
    });

    if (!existing) throw Errors.notFound('Schedule');

    if (['posted', 'posting'].includes(existing.status)) {
      throw Errors.badRequest('Cannot cancel a post that is already posted or posting');
    }

    await prisma.postSchedule.update({
      where: { id: params.id },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({ message: 'Schedule cancelled' });
  } catch (error) {
    return errorResponse(error);
  }
}
