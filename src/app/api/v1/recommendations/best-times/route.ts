import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { getBestTimeRecommendations } from '@/lib/recommendations';
import { PlatformSchema } from '@/lib/social/types';

// GET /api/v1/recommendations/best-times?socialAccountId=...&platform=...
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const socialAccountId = searchParams.get('socialAccountId');
    const platform = searchParams.get('platform');

    if (!socialAccountId || !platform) {
      throw Errors.badRequest('socialAccountId and platform are required');
    }

    const parsedPlatform = PlatformSchema.parse(platform);

    // Verify ownership
    const account = await prisma.socialAccount.findFirst({
      where: { id: socialAccountId, userId: user.sub },
    });
    if (!account) throw Errors.notFound('Social account');

    const recommendation = await getBestTimeRecommendations(
      user.sub,
      socialAccountId,
      parsedPlatform
    );

    return NextResponse.json({ data: recommendation });
  } catch (error) {
    return errorResponse(error);
  }
}
