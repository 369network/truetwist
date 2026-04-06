import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/errors';

export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type Permission =
  | 'team:manage'
  | 'team:invite'
  | 'team:remove_member'
  | 'team:change_role'
  | 'business:create'
  | 'business:edit'
  | 'business:delete'
  | 'content:create'
  | 'content:edit'
  | 'content:delete'
  | 'content:approve'
  | 'content:publish'
  | 'billing:manage'
  | 'analytics:view'
  | 'activity:view';

const ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
  owner: [
    'team:manage', 'team:invite', 'team:remove_member', 'team:change_role',
    'business:create', 'business:edit', 'business:delete',
    'content:create', 'content:edit', 'content:delete', 'content:approve', 'content:publish',
    'billing:manage', 'analytics:view', 'activity:view',
  ],
  admin: [
    'team:invite', 'team:remove_member', 'team:change_role',
    'business:create', 'business:edit',
    'content:create', 'content:edit', 'content:delete', 'content:approve', 'content:publish',
    'analytics:view', 'activity:view',
  ],
  editor: [
    'content:create', 'content:edit',
    'analytics:view',
  ],
  viewer: [
    'analytics:view',
  ],
};

export function hasPermission(role: TeamRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissionsForRole(role: TeamRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function canManageRole(actorRole: TeamRole, targetRole: TeamRole): boolean {
  const hierarchy: TeamRole[] = ['owner', 'admin', 'editor', 'viewer'];
  return hierarchy.indexOf(actorRole) < hierarchy.indexOf(targetRole);
}

export interface TeamContext {
  teamId: string;
  userId: string;
  role: TeamRole;
  businessIds: string[];
}

export async function getTeamContext(userId: string, teamId: string): Promise<TeamContext> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, ownerId: true },
  });

  if (!team) throw Errors.notFound('Team');

  if (team.ownerId === userId) {
    return { teamId, userId, role: 'owner', businessIds: [] };
  }

  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });

  if (!member) throw Errors.forbidden('You are not a member of this team');

  return {
    teamId,
    userId,
    role: member.role as TeamRole,
    businessIds: (member.businessIds as string[]) || [],
  };
}

export async function requirePermission(
  userId: string,
  teamId: string,
  permission: Permission
): Promise<TeamContext> {
  const ctx = await getTeamContext(userId, teamId);
  if (!hasPermission(ctx.role, permission)) {
    throw Errors.forbidden(`Insufficient permissions: requires ${permission}`);
  }
  return ctx;
}

export function canAccessBusiness(ctx: TeamContext, businessId: string): boolean {
  if (ctx.role === 'owner' || ctx.role === 'admin') return true;
  if (ctx.businessIds.length === 0) return true; // empty = all businesses
  return ctx.businessIds.includes(businessId);
}
