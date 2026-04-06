import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { requirePermission } from '@/lib/permissions';
import { errorResponse } from '@/lib/errors';

type Params = { params: Promise<{ teamId: string }> };

// GET /api/v1/teams/:teamId/activity - Get activity log
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { teamId } = await params;
    await requirePermission(auth.sub, teamId, 'activity:view');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 100);

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: { teamId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.activityLog.count({ where: { teamId } }),
    ]);

    return NextResponse.json({
      data: activities,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
