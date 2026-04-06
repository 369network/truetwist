import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { createBusinessSchema } from '@/lib/validations';
import { errorResponse, Errors } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);

    const businesses = await prisma.business.findMany({
      where: { userId: auth.sub },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            competitors: true,
            posts: true,
          },
        },
      },
    });

    return NextResponse.json({ data: businesses });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    const body = await request.json();
    const result = createBusinessSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const business = await prisma.business.create({
      data: {
        ...result.data,
        userId: auth.sub,
      },
    });

    // Mark onboarding as completed if this is the user's first business
    const businessCount = await prisma.business.count({ where: { userId: auth.sub } });
    if (businessCount === 1) {
      await prisma.user.update({
        where: { id: auth.sub },
        data: { onboardingCompleted: true },
      });
    }

    return NextResponse.json({ data: business }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
