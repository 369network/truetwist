import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { requirePermission } from '@/lib/permissions';
import { inviteMemberSchema } from '@/lib/team-validations';
import { errorResponse, Errors } from '@/lib/errors';
import crypto from 'crypto';

type Params = { params: Promise<{ teamId: string }> };

// GET /api/v1/teams/:teamId/invites - List pending invites
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { teamId } = await params;
    await requirePermission(auth.sub, teamId, 'team:invite');

    const invites = await prisma.teamInvite.findMany({
      where: { teamId, acceptedAt: null, revokedAt: null },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: invites });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/teams/:teamId/invites - Send an invite
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { teamId } = await params;
    const ctx = await requirePermission(auth.sub, teamId, 'team:invite');

    const body = await request.json();
    const result = inviteMemberSchema.safeParse(body);
    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { email, role } = result.data;

    // Check if already a member
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      const existingMember = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: existingUser.id } },
      });
      if (existingMember) {
        throw Errors.conflict('This user is already a team member');
      }
    }

    // Check for existing pending invite
    const existingInvite = await prisma.teamInvite.findFirst({
      where: { teamId, email, acceptedAt: null, revokedAt: null },
    });
    if (existingInvite) {
      throw Errors.conflict('An invite has already been sent to this email');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

    const invite = await prisma.teamInvite.create({
      data: {
        teamId,
        email,
        role,
        token,
        expiresAt,
        invitedById: auth.sub,
      },
      include: {
        invitedBy: { select: { id: true, name: true } },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        teamId,
        userId: auth.sub,
        action: 'member_invited',
        targetType: 'invite',
        targetId: invite.id,
        metadata: { email, role },
      },
    });

    return NextResponse.json({ data: invite }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/teams/:teamId/invites?inviteId=xxx - Revoke invite
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthUser(request);
    const { teamId } = await params;
    await requirePermission(auth.sub, teamId, 'team:invite');

    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get('inviteId');
    if (!inviteId) throw Errors.badRequest('inviteId is required');

    const invite = await prisma.teamInvite.findFirst({
      where: { id: inviteId, teamId, acceptedAt: null, revokedAt: null },
    });
    if (!invite) throw Errors.notFound('Invite');

    await prisma.teamInvite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ data: { revoked: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
