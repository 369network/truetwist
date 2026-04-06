export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { updateProfileSchema } from '@/lib/validations';
import { errorResponse, Errors } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);

    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        plan: true,
        provider: true,
        onboardingCompleted: true,
        createdAt: true,
        updatedAt: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    if (!user) {
      throw Errors.notFound('User');
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    const body = await request.json();
    const result = updateProfileSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const user = await prisma.user.update({
      where: { id: auth.sub },
      data: result.data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        plan: true,
        onboardingCompleted: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: user });
  } catch (error) {
    return errorResponse(error);
  }
}
