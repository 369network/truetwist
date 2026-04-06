export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { getHashtagStrategyRecommendation } from '@/lib/recommendations';
import { PlatformSchema } from '@/lib/social/types';

// GET /api/v1/recommendations/hashtag-strategy?businessId=...&platform=...
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const businessId = searchParams.get('businessId');
    const platform = searchParams.get('platform');

    if (!businessId || !platform) {
      throw Errors.badRequest('businessId and platform are required');
    }

    const parsedPlatform = PlatformSchema.parse(platform);

    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: user.sub },
    });
    if (!business) throw Errors.notFound('Business');

    const recommendation = await getHashtagStrategyRecommendation(
      user.sub,
      businessId,
      parsedPlatform
    );

    return NextResponse.json({ data: recommendation });
  } catch (error) {
    return errorResponse(error);
  }
}
