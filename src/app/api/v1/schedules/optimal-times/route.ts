import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { smartScheduler } from '@/lib/scheduling';
import { prisma } from '@/lib/prisma';
import { PlatformSchema } from '@/lib/social/types';

// GET /api/v1/schedules/optimal-times?socialAccountId=...&platform=...&timezone=...
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const socialAccountId = searchParams.get('socialAccountId');
    const platform = searchParams.get('platform');
    const timezone = searchParams.get('timezone') || 'UTC';
    const date = searchParams.get('date'); // optional: target date
    const count = parseInt(searchParams.get('count') || '5', 10);

    if (!socialAccountId || !platform) {
      throw Errors.badRequest('socialAccountId and platform are required');
    }

    const parsedPlatform = PlatformSchema.parse(platform);

    // Verify ownership
    const account = await prisma.socialAccount.findFirst({
      where: { id: socialAccountId, userId: user.sub },
    });
    if (!account) throw Errors.notFound('Social account');

    const slots = await smartScheduler.getOptimalSlots({
      userId: user.sub,
      socialAccountId,
      platform: parsedPlatform,
      timezone,
      preferredDate: date ? new Date(date) : undefined,
      count: Math.min(count, 20),
    });

    return NextResponse.json({ data: slots });
  } catch (error) {
    return errorResponse(error);
  }
}
