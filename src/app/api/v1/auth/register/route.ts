import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateAccessToken, generateRefreshToken, hashToken, getRefreshTokenExpiry } from '@/lib/auth';
import { registerSchema } from '@/lib/validations';
import { errorResponse, Errors } from '@/lib/errors';
import { sendWelcomeEmail } from '@/lib/email';
import type { PlanTier } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { email, password, name } = result.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw Errors.conflict('A user with this email already exists');
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        hashedPassword,
        provider: 'email',
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        avatarUrl: true,
        onboardingCompleted: true,
        createdAt: true,
      },
    });

    const accessToken = generateAccessToken(user.id, user.email, user.plan as PlanTier);
    const { token: refreshToken, jti } = generateRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    // Send welcome email (non-blocking)
    if (process.env.RESEND_API_KEY) {
      sendWelcomeEmail(user.email, user.name || '').catch(() => {});
    }

    return NextResponse.json({
      data: {
        user,
        accessToken,
        refreshToken,
      },
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
