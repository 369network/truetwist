export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { hashPassword } from '@/lib/auth';
import { resetPasswordSchema } from '@/lib/validations';
import { errorResponse, Errors } from '@/lib/errors';
import { checkRateLimit } from '@/middleware/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    await checkRateLimit(`reset-password:${ip}`, { windowMs: 15 * 60 * 1000, max: 5 });

    const body = await request.json();
    const result = resetPasswordSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { token, password } = result.data;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const userId = await redis.get(`password_reset:${hashedToken}`);
    if (!userId) {
      throw Errors.badRequest('Invalid or expired reset token');
    }

    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: { id: userId },
      data: { hashedPassword },
    });

    // Invalidate the reset token
    await redis.del(`password_reset:${hashedToken}`);

    // Revoke all refresh tokens for security
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({
      data: { message: 'Password has been reset successfully.' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
