import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { requirePermission } from '@/lib/permissions';
import { reviewPostSchema } from '@/lib/team-validations';
import { errorResponse, Errors } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

// POST /api/v1/posts/:id/review - Approve or reject a post
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { id } = await params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: { business: { select: { teamId: true } } },
    });

    if (!post) throw Errors.notFound('Post');
    if (post.status !== 'pending_review') {
      throw Errors.badRequest('Post is not pending review');
    }

    const teamId = post.business.teamId;
    if (!teamId) {
      throw Errors.badRequest('Post does not belong to a team business');
    }

    await requirePermission(auth.sub, teamId, 'content:approve');

    const body = await request.json();
    const result = reviewPostSchema.safeParse(body);
    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { action, reason } = result.data;

    const updateData =
      action === 'approve'
        ? { status: 'approved', approvedById: auth.sub, approvedAt: new Date() }
        : { status: 'rejected' as const, rejectedById: auth.sub, rejectedAt: new Date(), rejectionReason: reason };

    const updated = await prisma.post.update({
      where: { id },
      data: updateData,
    });

    await prisma.activityLog.create({
      data: {
        teamId,
        userId: auth.sub,
        action: action === 'approve' ? 'post_approved' : 'post_rejected',
        targetType: 'post',
        targetId: id,
        metadata: { reason: reason ?? null },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
