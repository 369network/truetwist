export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { getTeamContext } from '@/lib/permissions';
import { postCommentSchema } from '@/lib/team-validations';
import { errorResponse, Errors } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

// GET /api/v1/posts/:id/comments - List comments on a post
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { id } = await params;

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, userId: true, business: { select: { teamId: true } } },
    });

    if (!post) throw Errors.notFound('Post');

    // Verify access: must be post owner or team member
    if (post.userId !== auth.sub && post.business.teamId) {
      await getTeamContext(auth.sub, post.business.teamId);
    } else if (post.userId !== auth.sub) {
      throw Errors.forbidden('You do not have access to this post');
    }

    const comments = await prisma.postComment.findMany({
      where: { postId: id },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ data: comments });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/posts/:id/comments - Add a comment
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { id } = await params;

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, userId: true, business: { select: { teamId: true } } },
    });

    if (!post) throw Errors.notFound('Post');

    // Verify access
    if (post.userId !== auth.sub && post.business.teamId) {
      await getTeamContext(auth.sub, post.business.teamId);
    } else if (post.userId !== auth.sub) {
      throw Errors.forbidden('You do not have access to this post');
    }

    const body = await request.json();
    const result = postCommentSchema.safeParse(body);
    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const comment = await prisma.postComment.create({
      data: {
        postId: id,
        userId: auth.sub,
        content: result.data.content,
        mentions: result.data.mentions,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ data: comment }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
