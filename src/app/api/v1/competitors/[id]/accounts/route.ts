import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { addCompetitorAccountSchema } from '@/lib/competitors/validations';
import { errorResponse, Errors } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/competitors/:id/accounts
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = getAuthUser(request);
    const { id } = await params;

    const competitor = await prisma.competitor.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });
    if (!competitor || competitor.business.userId !== auth.sub) {
      throw Errors.notFound('Competitor');
    }

    const accounts = await prisma.competitorAccount.findMany({
      where: { competitorId: id },
      include: {
        _count: { select: { posts: true } },
      },
    });

    return NextResponse.json({ data: accounts });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/competitors/:id/accounts
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = getAuthUser(request);
    const { id } = await params;
    const body = await request.json();
    const result = addCompetitorAccountSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const competitor = await prisma.competitor.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });
    if (!competitor || competitor.business.userId !== auth.sub) {
      throw Errors.notFound('Competitor');
    }

    const account = await prisma.competitorAccount.create({
      data: {
        competitorId: id,
        platform: result.data.platform,
        handle: result.data.handle,
        profileUrl: result.data.profileUrl,
      },
    });

    return NextResponse.json({ data: account }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
