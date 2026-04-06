export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

// DELETE /api/v1/account — Request account deletion (GDPR right to erasure)
// Step 1: Creates a deletion request with a confirmation token
// Step 2: User confirms via POST /api/v1/account/delete/confirm with the token
export async function DELETE(request: NextRequest) {
  try {
    const user = getAuthUser(request);

    // Check for existing pending/confirmed deletion request
    const existing = await prisma.dataDeletionRequest.findFirst({
      where: {
        userId: user.sub,
        status: { in: ['pending', 'confirmed', 'processing'] },
      },
    });

    if (existing) {
      if (existing.status === 'pending') {
        return NextResponse.json({
          data: {
            deletionId: existing.id,
            status: 'pending',
            message: 'A deletion request is already pending confirmation. Use the confirmation token to proceed.',
            confirmEndpoint: '/api/v1/account/delete/confirm',
          },
        });
      }
      throw Errors.conflict(
        'Account deletion is already confirmed and being processed.'
      );
    }

    const confirmationToken = crypto.randomBytes(32).toString('hex');

    const deletionRequest = await prisma.dataDeletionRequest.create({
      data: {
        userId: user.sub,
        status: 'pending',
        confirmationToken,
        // Schedule deletion 72 hours after confirmation to allow cancellation
        scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    // Log the deletion request
    await prisma.auditLog.create({
      data: {
        userId: user.sub,
        action: 'data.deletion_requested',
        resource: 'user',
        resourceId: user.sub,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
        metadata: { deletionRequestId: deletionRequest.id },
        severity: 'critical',
      },
    });

    return NextResponse.json({
      data: {
        deletionId: deletionRequest.id,
        status: 'pending',
        confirmationToken,
        confirmEndpoint: '/api/v1/account/delete/confirm',
        message: 'Account deletion requested. Send a POST to the confirm endpoint with your confirmation token to proceed. After confirmation, deletion is scheduled with a 72-hour grace period.',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
