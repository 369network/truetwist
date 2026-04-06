export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

// POST /api/v1/account/delete/confirm — Confirm account deletion
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    const { confirmationToken } = body;

    if (!confirmationToken || typeof confirmationToken !== 'string') {
      throw Errors.validation({ confirmationToken: 'Confirmation token is required' });
    }

    const deletionRequest = await prisma.dataDeletionRequest.findUnique({
      where: { confirmationToken },
    });

    if (!deletionRequest || deletionRequest.userId !== user.sub) {
      throw Errors.notFound('Deletion request');
    }

    if (deletionRequest.status !== 'pending') {
      throw Errors.badRequest(
        `Deletion request is already ${deletionRequest.status}.`
      );
    }

    // Confirm and schedule deletion
    const scheduledAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72-hour grace period

    await prisma.dataDeletionRequest.update({
      where: { id: deletionRequest.id },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
        scheduledAt,
      },
    });

    // Log confirmation
    await prisma.auditLog.create({
      data: {
        userId: user.sub,
        action: 'data.deletion_confirmed',
        resource: 'user',
        resourceId: user.sub,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
        metadata: { deletionRequestId: deletionRequest.id, scheduledAt: scheduledAt.toISOString() },
        severity: 'critical',
      },
    });

    return NextResponse.json({
      data: {
        deletionId: deletionRequest.id,
        status: 'confirmed',
        scheduledAt,
        message: `Account deletion confirmed. Your account and all associated data will be permanently deleted after ${scheduledAt.toISOString()}. You can cancel this by contacting support within the grace period.`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/account/delete/confirm — Cancel a confirmed deletion (within grace period)
export async function DELETE(request: NextRequest) {
  try {
    const user = getAuthUser(request);

    const deletionRequest = await prisma.dataDeletionRequest.findFirst({
      where: {
        userId: user.sub,
        status: { in: ['pending', 'confirmed'] },
      },
    });

    if (!deletionRequest) {
      throw Errors.notFound('Active deletion request');
    }

    await prisma.dataDeletionRequest.update({
      where: { id: deletionRequest.id },
      data: { status: 'failed', errorMessage: 'Cancelled by user' },
    });

    // Log cancellation
    await prisma.auditLog.create({
      data: {
        userId: user.sub,
        action: 'data.deletion_cancelled',
        resource: 'user',
        resourceId: user.sub,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
        metadata: { deletionRequestId: deletionRequest.id },
        severity: 'info',
      },
    });

    return NextResponse.json({
      data: {
        deletionId: deletionRequest.id,
        status: 'cancelled',
        message: 'Account deletion has been cancelled. Your account remains active.',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
