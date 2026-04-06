import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { getPostingFrequencyRecommendation } from '@/lib/recommendations';
import { PlatformSchema } from '@/lib/social/types';

// GET /api/v1/recommendations/posting-frequency?businessId=...&socialAccountId=...&platform=...
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const businessId = searchParams.get('businessId');
    const socialAccountId = searchParams.get('socialAccountId');
    const platform = searchParams.get('platform');

    if (!businessId || !socialAccountId || !platform) {
      throw Errors.badRequest('businessId, socialAccountId, and platform are required');
    }

    const parsedPlatform = PlatformSchema.parse(platform);

    // Verify ownership
    const [business, account] = await Promise.all([
      prisma.business.findFirst({ where: { id: businessId, userId: user.sub } }),
      prisma.socialAccount.findFirst({ where: { id: socialAccountId, userId: user.sub } }),
    ]);
    if (!business) throw Errors.notFound('Business');
    if (!account) throw Errors.notFound('Social account');

    const recommendation = await getPostingFrequencyRecommendation(
      user.sub,
      businessId,
      parsedPlatform,
      socialAccountId
    );

    return NextResponse.json({ data: recommendation });
  } catch (error) {
    return errorResponse(error);
  }
}
