export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

// POST /api/v1/auth/verify-email - Send verification email
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.sub },
    });

    if (!dbUser) {
      throw Errors.notFound('User');
    }

    if (dbUser.emailVerified) {
      return NextResponse.json({
        data: { message: 'Email is already verified.' },
      });
    }

    // Generate verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verifyToken).digest('hex');

    // Store in Redis with 24 hour expiry
    await redis.setex(`email_verify:${hashedToken}`, 86400, dbUser.id);

    // TODO: Send verification email via Resend when configured

    return NextResponse.json({
      data: { message: 'Verification email sent.' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /api/v1/auth/verify-email?token=... - Confirm email verification
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      throw Errors.badRequest('Missing verification token');
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const userId = await redis.get(`email_verify:${hashedToken}`);

    if (!userId) {
      throw Errors.badRequest('Invalid or expired verification token');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });

    await redis.del(`email_verify:${hashedToken}`);

    return NextResponse.json({
      data: { message: 'Email verified successfully.' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
