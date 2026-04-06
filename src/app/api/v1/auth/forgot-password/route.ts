export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { sendPasswordResetEmail } from '@/lib/email';
import { forgotPasswordSchema } from '@/lib/validations';
import { errorResponse, Errors } from '@/lib/errors';
import { checkRateLimit } from '@/middleware/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    await checkRateLimit(`forgot-password:${ip}`, { windowMs: 60 * 60 * 1000, max: 3 });

    const body = await request.json();
    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { email } = result.data;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        data: { message: 'If an account exists, a password reset email will be sent.' },
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store in Redis with 1 hour expiry
    await redis.setex(`password_reset:${hashedToken}`, 3600, user.id);

    // Send password reset email via Resend
    if (process.env.RESEND_API_KEY) {
      await sendPasswordResetEmail(email, resetToken);
    }

    return NextResponse.json({
      data: { message: 'If an account exists, a password reset email will be sent.' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
