export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateAccessToken, generateRefreshToken, hashToken, getRefreshTokenExpiry } from '@/lib/auth';
import { loginSchema } from '@/lib/validations';
import { errorResponse, Errors } from '@/lib/errors';
import { checkRateLimit } from '@/middleware/rate-limit';
import { auditFromRequest, AuditActions } from '@/lib/audit';
import type { PlanTier } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    await checkRateLimit(`login:${ip}`, { windowMs: 15 * 60 * 1000, max: 5 });

    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        avatarUrl: true,
        hashedPassword: true,
        onboardingCompleted: true,
      },
    });

    if (!user || !user.hashedPassword) {
      auditFromRequest(request, {
        action: AuditActions.LOGIN_FAILED,
        metadata: { email, reason: 'user_not_found' },
        severity: 'warning',
      });
      throw Errors.unauthorized('Invalid email or password');
    }

    const isValid = await verifyPassword(password, user.hashedPassword);
    if (!isValid) {
      auditFromRequest(request, {
        userId: user.id,
        action: AuditActions.LOGIN_FAILED,
        resource: 'user',
        resourceId: user.id,
        metadata: { email, reason: 'invalid_password' },
        severity: 'warning',
      });
      throw Errors.unauthorized('Invalid email or password');
    }

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

    auditFromRequest(request, {
      userId: user.id,
      action: AuditActions.LOGIN_SUCCESS,
      resource: 'user',
      resourceId: user.id,
      metadata: { email: user.email },
    });

    const { hashedPassword: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      data: {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
