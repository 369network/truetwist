export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { generateWeeklyInsights } from '@/lib/recommendations';
import { z } from 'zod';

const querySchema = z.object({
  businessId: z.string().uuid(),
  socialAccountIds: z.string().min(1), // comma-separated UUIDs
});

// GET /api/v1/recommendations/weekly-insights?businessId=...&socialAccountIds=id1,id2
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const params = querySchema.parse({
      businessId: searchParams.get('businessId'),
      socialAccountIds: searchParams.get('socialAccountIds'),
    });

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { id: params.businessId, userId: user.sub },
    });
    if (!business) throw Errors.notFound('Business');

    const socialAccountIds = params.socialAccountIds.split(',').map((id) => id.trim());

    // Verify account ownership
    const accounts = await prisma.socialAccount.findMany({
      where: { id: { in: socialAccountIds }, userId: user.sub },
    });
    if (accounts.length === 0) {
      throw Errors.badRequest('No valid social accounts found');
    }

    const insights = await generateWeeklyInsights(
      user.sub,
      params.businessId,
      accounts.map((a) => a.id)
    );

    return NextResponse.json({ data: insights });
  } catch (error) {
    return errorResponse(error);
  }
}
