import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiKeyUser, requireScope } from '@/middleware/api-key';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/public/posts/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'read');

    const post = await prisma.post.findFirst({
      where: { id: params.id, userId: apiUser.sub },
      include: {
        media: true,
        schedules: {
          select: {
            id: true,
            platform: true,
            scheduledAt: true,
            status: true,
            platformPostUrl: true,
          },
        },
      },
    });

    if (!post) throw Errors.notFound('Post');

    return NextResponse.json({ data: post });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/public/posts/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'write');

    const existing = await prisma.post.findFirst({
      where: { id: params.id, userId: apiUser.sub },
    });

    if (!existing) throw Errors.notFound('Post');

    if (existing.status !== 'draft') {
      throw Errors.badRequest('Only draft posts can be edited');
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.contentText !== undefined) updateData.contentText = body.contentText;
    if (body.contentType !== undefined) updateData.contentType = body.contentType;

    const updated = await prisma.post.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/public/posts/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'write');

    const existing = await prisma.post.findFirst({
      where: { id: params.id, userId: apiUser.sub },
    });

    if (!existing) throw Errors.notFound('Post');

    await prisma.post.delete({ where: { id: params.id } });

    return NextResponse.json({ message: 'Post deleted' });
  } catch (error) {
    return errorResponse(error);
  }
}
