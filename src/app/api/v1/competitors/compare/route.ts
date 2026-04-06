import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { buildCompetitiveComparison } from '@/lib/competitors/analysis-engine';

// GET /api/v1/competitors/compare?businessId=xxx
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    const businessId = request.nextUrl.searchParams.get('businessId');

    if (!businessId) {
      throw Errors.badRequest('businessId query parameter is required');
    }

    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: auth.sub },
    });
    if (!business) {
      throw Errors.notFound('Business');
    }

    // Get user's social account IDs
    const userAccounts = await prisma.socialAccount.findMany({
      where: { userId: auth.sub, isActive: true },
      select: { id: true },
    });
    const userAccountIds = userAccounts.map(a => a.id);

    const comparison = await buildCompetitiveComparison(
      businessId,
      auth.sub,
      userAccountIds
    );

    return NextResponse.json({ data: comparison });
  } catch (error) {
    return errorResponse(error);
  }
}
