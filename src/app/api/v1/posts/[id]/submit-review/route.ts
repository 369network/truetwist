export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

// POST /api/v1/posts/:id/submit-review - Submit post for team review
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { id } = await params;

    const post = await prisma.post.findFirst({
      where: { id, userId: auth.sub },
      include: { business: { select: { teamId: true } } },
    });

    if (!post) throw Errors.notFound('Post');
    if (post.status !== 'draft') {
      throw Errors.badRequest('Only draft posts can be submitted for review');
    }

    const updated = await prisma.post.update({
      where: { id },
      data: { status: 'pending_review' },
    });

    // Log activity if team-based
    if (post.business.teamId) {
      await prisma.activityLog.create({
        data: {
          teamId: post.business.teamId,
          userId: auth.sub,
          action: 'post_submitted_review',
          targetType: 'post',
          targetId: id,
          metadata: { contentType: post.contentType },
        },
      });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
