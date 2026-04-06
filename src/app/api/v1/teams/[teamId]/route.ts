import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { requirePermission } from '@/lib/permissions';
import { updateTeamSchema } from '@/lib/team-validations';
import { errorResponse } from '@/lib/errors';

type Params = { params: Promise<{ teamId: string }> };

// GET /api/v1/teams/:teamId - Get team details
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { teamId } = await params;
    await requirePermission(auth.sub, teamId, 'analytics:view');

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { invitedAt: 'asc' },
        },
        invites: {
          where: { acceptedAt: null, revokedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            invitedBy: { select: { id: true, name: true } },
          },
        },
        _count: { select: { members: true } },
      },
    });

    return NextResponse.json({ data: team });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/teams/:teamId - Update team
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { teamId } = await params;
    await requirePermission(auth.sub, teamId, 'team:manage');

    const body = await request.json();
    const result = updateTeamSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten().fieldErrors }, { status: 422 });
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: result.data,
    });

    return NextResponse.json({ data: team });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/teams/:teamId - Delete team (owner only)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { teamId } = await params;
    await requirePermission(auth.sub, teamId, 'team:manage');

    await prisma.team.delete({ where: { id: teamId } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
