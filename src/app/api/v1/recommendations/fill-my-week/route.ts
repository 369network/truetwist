import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { fillMyWeek } from '@/lib/recommendations';
import { z } from 'zod';

const bodySchema = z.object({
  businessId: z.string().uuid(),
  socialAccountIds: z.array(z.string().uuid()).min(1),
  startDate: z.string().datetime().optional(),
  timezone: z.string().default('UTC'),
  postsPerDay: z.number().min(1).max(5).optional(),
});

// POST /api/v1/recommendations/fill-my-week
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = bodySchema.parse(await request.json());

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { id: body.businessId, userId: user.sub },
    });
    if (!business) throw Errors.notFound('Business');

    // Verify social account ownership
    const accounts = await prisma.socialAccount.findMany({
      where: { id: { in: body.socialAccountIds }, userId: user.sub, isActive: true },
    });
    if (accounts.length === 0) {
      throw Errors.badRequest('No valid active social accounts found');
    }

    const result = await fillMyWeek({
      userId: user.sub,
      businessId: body.businessId,
      socialAccountIds: accounts.map((a) => a.id),
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      timezone: body.timezone,
      postsPerDay: body.postsPerDay,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
