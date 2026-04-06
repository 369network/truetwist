export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { updateBusinessSchema } from '@/lib/validations';
import { errorResponse, Errors } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthUser(request);

    const business = await prisma.business.findFirst({
      where: { id: params.id, userId: auth.sub },
      include: {
        competitors: {
          include: {
            accounts: true,
          },
        },
        _count: {
          select: { posts: true },
        },
      },
    });

    if (!business) {
      throw Errors.notFound('Business');
    }

    return NextResponse.json({ data: business });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthUser(request);
    const body = await request.json();
    const result = updateBusinessSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const business = await prisma.business.updateMany({
      where: { id: params.id, userId: auth.sub },
      data: result.data,
    });

    if (business.count === 0) {
      throw Errors.notFound('Business');
    }

    const updated = await prisma.business.findFirst({
      where: { id: params.id, userId: auth.sub },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthUser(request);

    const existing = await prisma.business.findFirst({
      where: { id: params.id, userId: auth.sub },
    });

    if (!existing) {
      throw Errors.notFound('Business');
    }

    await prisma.business.delete({ where: { id: params.id } });

    return NextResponse.json({ data: { message: 'Business deleted.' } });
  } catch (error) {
    return errorResponse(error);
  }
}
