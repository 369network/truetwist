export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/social-accounts/:id - Get social account details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);
    const account = await prisma.socialAccount.findFirst({
      where: { id: params.id, userId: user.sub },
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountHandle: true,
        followerCount: true,
        isActive: true,
        connectedAt: true,
        tokenExpiresAt: true,
        postSchedules: {
          select: { id: true, status: true, scheduledAt: true },
          orderBy: { scheduledAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!account) {
      throw Errors.notFound('Social account');
    }

    return NextResponse.json({ data: account });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/social-accounts/:id - Disconnect a social account
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);
    const account = await prisma.socialAccount.findFirst({
      where: { id: params.id, userId: user.sub },
    });

    if (!account) {
      throw Errors.notFound('Social account');
    }

    // Soft-disconnect: deactivate rather than delete to preserve post history
    await prisma.socialAccount.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({
      data: { message: 'Social account disconnected.' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
