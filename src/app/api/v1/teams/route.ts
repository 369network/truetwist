export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { createTeamSchema } from '@/lib/team-validations';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/teams - List user's teams
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);

    const [ownedTeams, memberTeams] = await Promise.all([
      prisma.team.findMany({
        where: { ownerId: auth.sub },
        include: {
          _count: { select: { members: true, invites: { where: { acceptedAt: null, revokedAt: null } } } },
        },
      }),
      prisma.teamMember.findMany({
        where: { userId: auth.sub },
        include: {
          team: {
            include: {
              _count: { select: { members: true } },
              owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
        },
      }),
    ]);

    const teams = [
      ...ownedTeams.map((t) => ({ ...t, myRole: 'owner' as const })),
      ...memberTeams.map((m) => ({ ...m.team, myRole: m.role })),
    ];

    return NextResponse.json({ data: teams });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/teams - Create a new team
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    const body = await request.json();
    const result = createTeamSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const team = await prisma.team.create({
      data: {
        name: result.data.name,
        ownerId: auth.sub,
        members: {
          create: {
            userId: auth.sub,
            role: 'owner',
            joinedAt: new Date(),
          },
        },
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    return NextResponse.json({ data: team }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
