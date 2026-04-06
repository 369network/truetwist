import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { requirePermission, canManageRole, type TeamRole } from '@/lib/permissions';
import { updateMemberRoleSchema, updateMemberBusinessAccessSchema } from '@/lib/team-validations';
import { errorResponse, Errors } from '@/lib/errors';

type Params = { params: Promise<{ teamId: string; userId: string }> };

// PATCH /api/v1/teams/:teamId/members/:userId - Update member role or business access
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { teamId, userId } = await params;
    const ctx = await requirePermission(auth.sub, teamId, 'team:change_role');

    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw Errors.notFound('Team member');

    // Cannot change owner role
    if (member.role === 'owner') {
      throw Errors.forbidden('Cannot change the owner\'s role');
    }

    const body = await request.json();

    // Handle role update
    if (body.role !== undefined) {
      const roleResult = updateMemberRoleSchema.safeParse(body);
      if (!roleResult.success) {
        throw Errors.validation(roleResult.error.flatten().fieldErrors);
      }

      if (!canManageRole(ctx.role, roleResult.data.role as TeamRole)) {
        throw Errors.forbidden('Cannot assign a role equal to or above your own');
      }

      await prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId } },
        data: { role: roleResult.data.role },
      });

      await prisma.activityLog.create({
        data: {
          teamId,
          userId: auth.sub,
          action: 'role_changed',
          targetType: 'user',
          targetId: userId,
          metadata: { oldRole: member.role, newRole: roleResult.data.role },
        },
      });
    }

    // Handle business access update
    if (body.businessIds !== undefined) {
      const bizResult = updateMemberBusinessAccessSchema.safeParse(body);
      if (!bizResult.success) {
        throw Errors.validation(bizResult.error.flatten().fieldErrors);
      }

      await prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId } },
        data: { businessIds: bizResult.data.businessIds },
      });
    }

    const updated = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/teams/:teamId/members/:userId - Remove member
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { teamId, userId } = await params;

    // Allow self-removal or require permission
    if (auth.sub !== userId) {
      await requirePermission(auth.sub, teamId, 'team:remove_member');
    }

    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw Errors.notFound('Team member');
    if (member.role === 'owner') {
      throw Errors.forbidden('Cannot remove the team owner');
    }

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });

    await prisma.activityLog.create({
      data: {
        teamId,
        userId: auth.sub,
        action: 'member_removed',
        targetType: 'user',
        targetId: userId,
        metadata: { removedByself: auth.sub === userId },
      },
    });

    return NextResponse.json({ data: { removed: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
