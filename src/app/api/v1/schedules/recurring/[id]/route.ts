export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { z } from 'zod';

const updateRecurringSchema = z.object({
  dayOfWeek: z.number().min(0).max(6).optional(),
  timeUtc: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
  templatePostId: z.string().uuid().nullable().optional(),
});

// GET /api/v1/schedules/recurring/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);

    const recurring = await prisma.recurringSchedule.findFirst({
      where: { id: params.id, userId: user.sub },
      include: {
        schedules: {
          orderBy: { scheduledAt: 'desc' },
          take: 10,
          include: {
            post: { select: { id: true, contentText: true, status: true } },
          },
        },
      },
    });

    if (!recurring) throw Errors.notFound('Recurring schedule');

    return NextResponse.json({ data: recurring });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/schedules/recurring/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = updateRecurringSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const existing = await prisma.recurringSchedule.findFirst({
      where: { id: params.id, userId: user.sub },
    });
    if (!existing) throw Errors.notFound('Recurring schedule');

    const updated = await prisma.recurringSchedule.update({
      where: { id: params.id },
      data: result.data,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/schedules/recurring/:id - Deactivate (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);

    const existing = await prisma.recurringSchedule.findFirst({
      where: { id: params.id, userId: user.sub },
    });
    if (!existing) throw Errors.notFound('Recurring schedule');

    await prisma.recurringSchedule.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ data: { message: 'Recurring schedule deactivated.' } });
  } catch (error) {
    return errorResponse(error);
  }
}
