import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken, hashToken, getRefreshTokenExpiry } from '@/lib/auth';
import { errorResponse, Errors } from '@/lib/errors';
import type { PlanTier } from '@/types';

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      throw Errors.badRequest('Invalid JSON body');
    }

    const result = refreshSchema.safeParse(body);
    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const token = result.data.refreshToken;

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw Errors.unauthorized('Invalid or expired refresh token');
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!storedToken || storedToken.revokedAt) {
      // Token reuse detected - revoke all tokens for this user
      if (storedToken) {
        await prisma.refreshToken.updateMany({
          where: { userId: storedToken.userId },
          data: { revokedAt: new Date() },
        });
      }
      throw Errors.unauthorized('Token has been revoked');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, plan: true },
    });

    if (!user) {
      throw Errors.unauthorized('User not found');
    }

    // Rotate: revoke old, issue new
    const { token: newRefreshToken, jti: newJti } = generateRefreshToken(user.id);

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: payload.jti },
        data: { revokedAt: new Date(), replacedBy: newJti },
      }),
      prisma.refreshToken.create({
        data: {
          id: newJti,
          userId: user.id,
          tokenHash: hashToken(newRefreshToken),
          expiresAt: getRefreshTokenExpiry(),
        },
      }),
    ]);

    const accessToken = generateAccessToken(user.id, user.email, user.plan as PlanTier);

    return NextResponse.json({
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
