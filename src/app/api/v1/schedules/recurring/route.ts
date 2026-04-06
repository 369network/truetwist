export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { PlatformSchema } from '@/lib/social/types';
import { z } from 'zod';

const createRecurringSchema = z.object({
  businessId: z.string().uuid(),
  socialAccountId: z.string().uuid(),
  platform: PlatformSchema,
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
  dayOfWeek: z.number().min(0).max(6).optional(), // required for weekly/biweekly
  timeUtc: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
  timezone: z.string().default('UTC'),
  templatePostId: z.string().uuid().optional(),
});

// POST /api/v1/schedules/recurring - Create a recurring schedule
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = createRecurringSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { businessId, socialAccountId, platform, frequency, dayOfWeek, timeUtc, timezone, templatePostId } = result.data;

    // Validate dayOfWeek for weekly/biweekly
    if ((frequency === 'weekly' || frequency === 'biweekly') && dayOfWeek === undefined) {
      throw Errors.badRequest('dayOfWeek is required for weekly and biweekly schedules');
    }

    // Verify ownership
    const [business, account] = await Promise.all([
      prisma.business.findFirst({ where: { id: businessId, userId: user.sub } }),
      prisma.socialAccount.findFirst({ where: { id: socialAccountId, userId: user.sub, isActive: true } }),
    ]);
    if (!business) throw Errors.notFound('Business');
    if (!account) throw Errors.notFound('Social account');

    // Calculate next occurrence
    const nextOccurrence = calculateNextOccurrence(frequency, dayOfWeek, timeUtc);

    const recurring = await prisma.recurringSchedule.create({
      data: {
        userId: user.sub,
        businessId,
        socialAccountId,
        platform,
        frequency,
        dayOfWeek,
        timeUtc,
        timezone,
        templatePostId,
        nextOccurrence,
      },
    });

    return NextResponse.json({ data: recurring }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /api/v1/schedules/recurring - List recurring schedules
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = { userId: user.sub };
    if (businessId) where.businessId = businessId;
    if (isActive !== null) where.isActive = isActive === 'true';

    const schedules = await prisma.recurringSchedule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: schedules });
  } catch (error) {
    return errorResponse(error);
  }
}

function calculateNextOccurrence(
  frequency: string,
  dayOfWeek: number | undefined,
  timeUtc: string
): Date {
  const [hours, minutes] = timeUtc.split(':').map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hours, minutes, 0, 0);

  if (frequency === 'daily') {
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  } else if (frequency === 'weekly' || frequency === 'biweekly') {
    const currentDay = now.getUTCDay();
    const target = dayOfWeek ?? 0;
    let daysUntil = target - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && next.getTime() <= now.getTime())) {
      daysUntil += frequency === 'biweekly' ? 14 : 7;
    }
    next.setUTCDate(next.getUTCDate() + daysUntil);
  } else if (frequency === 'monthly') {
    if (next.getTime() <= now.getTime()) {
      next.setUTCMonth(next.getUTCMonth() + 1);
    }
  }

  return next;
}
