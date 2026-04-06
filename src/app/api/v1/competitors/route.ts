import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { createCompetitorSchema } from '@/lib/competitors/validations';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/competitors?businessId=xxx
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    const businessId = request.nextUrl.searchParams.get('businessId');

    if (!businessId) {
      throw Errors.badRequest('businessId query parameter is required');
    }

    // Verify user owns the business
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: auth.sub },
    });
    if (!business) {
      throw Errors.notFound('Business');
    }

    const competitors = await prisma.competitor.findMany({
      where: { businessId },
      include: {
        accounts: {
          select: {
            id: true,
            platform: true,
            handle: true,
            profileUrl: true,
            followerCount: true,
            engagementRate: true,
            postingFrequency: true,
            lastScrapedAt: true,
          },
        },
        _count: { select: { accounts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: competitors });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/competitors
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    const body = await request.json();
    const result = createCompetitorSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    // Verify user owns the business
    const business = await prisma.business.findFirst({
      where: { id: result.data.businessId, userId: auth.sub },
    });
    if (!business) {
      throw Errors.notFound('Business');
    }

    const competitor = await prisma.competitor.create({
      data: {
        businessId: result.data.businessId,
        name: result.data.name,
        websiteUrl: result.data.websiteUrl,
        accounts: result.data.accounts
          ? {
              create: result.data.accounts.map(a => ({
                platform: a.platform,
                handle: a.handle,
                profileUrl: a.profileUrl,
              })),
            }
          : undefined,
      },
      include: {
        accounts: true,
      },
    });

    return NextResponse.json({ data: competitor }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
