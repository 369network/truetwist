export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/posts/:id/schedules - Get schedules for a post
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request);

    const post = await prisma.post.findFirst({
      where: { id: params.id, userId: user.sub },
    });

    if (!post) throw Errors.notFound('Post');

    const schedules = await prisma.postSchedule.findMany({
      where: { postId: params.id },
      include: {
        socialAccount: {
          select: { id: true, platform: true, accountName: true, accountHandle: true },
        },
        analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json({ data: schedules });
  } catch (error) {
    return errorResponse(error);
  }
}
