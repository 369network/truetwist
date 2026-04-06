import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { updateCompetitorSchema } from '@/lib/competitors/validations';
import { errorResponse, Errors } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/competitors/:id
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = getAuthUser(request);
    const { id } = await params;

    const competitor = await prisma.competitor.findUnique({
      where: { id },
      include: {
        business: { select: { userId: true } },
        accounts: {
          include: {
            _count: { select: { posts: true, snapshots: true } },
          },
        },
      },
    });

    if (!competitor || competitor.business.userId !== auth.sub) {
      throw Errors.notFound('Competitor');
    }

    const { business, ...data } = competitor;
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/competitors/:id
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = getAuthUser(request);
    const { id } = await params;
    const body = await request.json();
    const result = updateCompetitorSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    // Verify ownership
    const existing = await prisma.competitor.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });
    if (!existing || existing.business.userId !== auth.sub) {
      throw Errors.notFound('Competitor');
    }

    const competitor = await prisma.competitor.update({
      where: { id },
      data: result.data,
      include: { accounts: true },
    });

    return NextResponse.json({ data: competitor });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/competitors/:id
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = getAuthUser(request);
    const { id } = await params;

    const existing = await prisma.competitor.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });
    if (!existing || existing.business.userId !== auth.sub) {
      throw Errors.notFound('Competitor');
    }

    await prisma.competitor.delete({ where: { id } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
