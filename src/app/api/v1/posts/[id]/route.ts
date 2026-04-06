export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { z } from 'zod';

const updatePostSchema = z.object({
  contentText: z.string().max(10000).optional(),
  contentType: z.enum(['text', 'image', 'video', 'carousel']).optional(),
});

// GET /api/v1/posts/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);

    const post = await prisma.post.findFirst({
      where: { id: params.id, userId: user.sub },
      include: {
        business: { select: { id: true, name: true } },
        media: true,
        schedules: {
          include: {
            socialAccount: {
              select: { id: true, platform: true, accountName: true, accountHandle: true },
            },
            analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    if (!post) {
      throw Errors.notFound('Post');
    }

    return NextResponse.json({ data: post });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/posts/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = updatePostSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const existing = await prisma.post.findFirst({
      where: { id: params.id, userId: user.sub },
    });

    if (!existing) {
      throw Errors.notFound('Post');
    }

    if (!['draft', 'scheduled', 'failed'].includes(existing.status)) {
      throw Errors.badRequest('Only draft, scheduled, or failed posts can be edited');
    }

    const post = await prisma.post.update({
      where: { id: params.id },
      data: result.data,
      include: {
        business: { select: { id: true, name: true } },
        media: true,
      },
    });

    return NextResponse.json({ data: post });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/posts/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);

    const post = await prisma.post.findFirst({
      where: { id: params.id, userId: user.sub },
    });

    if (!post) {
      throw Errors.notFound('Post');
    }

    if (post.status === 'posting') {
      throw Errors.badRequest('Cannot delete a post that is currently being published');
    }

    await prisma.post.delete({ where: { id: params.id } });

    return NextResponse.json({ data: { message: 'Post deleted.' } });
  } catch (error) {
    return errorResponse(error);
  }
}
