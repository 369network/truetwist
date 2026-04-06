import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { requirePermission, canAccessBusiness } from '@/lib/permissions';
import { createBusinessSchema } from '@/lib/validations';
import { errorResponse, Errors } from '@/lib/errors';

type Params = { params: Promise<{ teamId: string }> };

// GET /api/v1/teams/:teamId/businesses - List team businesses
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { teamId } = await params;
    const ctx = await requirePermission(auth.sub, teamId, 'analytics:view');

    const businesses = await prisma.business.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { competitors: true, posts: true } },
      },
    });

    // Filter by business access for non-admin users
    const accessible = businesses.filter((b) => canAccessBusiness(ctx, b.id));

    return NextResponse.json({ data: accessible });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/teams/:teamId/businesses - Create business under team
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { teamId } = await params;
    await requirePermission(auth.sub, teamId, 'business:create');

    const body = await request.json();
    const result = createBusinessSchema.safeParse(body);
    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const business = await prisma.business.create({
      data: {
        ...result.data,
        userId: auth.sub,
        teamId,
      },
    });

    await prisma.activityLog.create({
      data: {
        teamId,
        userId: auth.sub,
        action: 'business_created',
        targetType: 'business',
        targetId: business.id,
        metadata: { name: business.name },
      },
    });

    return NextResponse.json({ data: business }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
