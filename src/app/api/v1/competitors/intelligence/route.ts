import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { generateIntelligenceReport } from '@/lib/competitors/analysis-engine';

// GET /api/v1/competitors/intelligence?businessId=xxx
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

    const report = await generateIntelligenceReport(businessId);

    return NextResponse.json({ data: report });
  } catch (error) {
    return errorResponse(error);
  }
}
