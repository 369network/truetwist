export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

// POST /api/v1/invites/accept - Accept a team invite
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      throw Errors.badRequest('Invite token is required');
    }

    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      include: { team: { select: { id: true, name: true } } },
    });

    if (!invite) throw Errors.notFound('Invite');
    if (invite.acceptedAt) throw Errors.conflict('Invite has already been accepted');
    if (invite.revokedAt) throw Errors.conflict('Invite has been revoked');
    if (invite.expiresAt < new Date()) throw Errors.conflict('Invite has expired');

    // Verify the accepting user's email matches the invite
    const user = await prisma.user.findUnique({ where: { id: auth.sub }, select: { email: true } });
    if (user?.email !== invite.email) {
      throw Errors.forbidden('This invite was sent to a different email address');
    }

    // Check if already a member
    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId: auth.sub } },
    });
    if (existing) {
      throw Errors.conflict('You are already a member of this team');
    }

    // Accept the invite in a transaction
    await prisma.$transaction([
      prisma.teamInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
      prisma.teamMember.create({
        data: {
          teamId: invite.teamId,
          userId: auth.sub,
          role: invite.role,
          joinedAt: new Date(),
        },
      }),
      prisma.activityLog.create({
        data: {
          teamId: invite.teamId,
          userId: auth.sub,
          action: 'member_joined',
          targetType: 'user',
          targetId: auth.sub,
          metadata: { role: invite.role, fromInvite: invite.id },
        },
      }),
    ]);

    return NextResponse.json({
      data: { teamId: invite.teamId, teamName: invite.team.name, role: invite.role },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
