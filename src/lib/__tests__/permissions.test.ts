import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  getPermissionsForRole,
  canManageRole,
  canAccessBusiness,
  type TeamRole,
  type Permission,
  type TeamContext,
} from '@/lib/permissions';

describe('permissions module', () => {
  describe('hasPermission', () => {
    it('owner has all permissions', () => {
      const allPermissions: Permission[] = [
        'team:manage', 'team:invite', 'team:remove_member', 'team:change_role',
        'business:create', 'business:edit', 'business:delete',
        'content:create', 'content:edit', 'content:delete', 'content:approve', 'content:publish',
        'billing:manage', 'analytics:view', 'activity:view',
      ];
      for (const perm of allPermissions) {
        expect(hasPermission('owner', perm)).toBe(true);
      }
    });

    it('admin cannot manage team settings or billing', () => {
      expect(hasPermission('admin', 'team:manage')).toBe(false);
      expect(hasPermission('admin', 'billing:manage')).toBe(false);
      expect(hasPermission('admin', 'business:delete')).toBe(false);
    });

    it('admin can invite, remove members, and approve content', () => {
      expect(hasPermission('admin', 'team:invite')).toBe(true);
      expect(hasPermission('admin', 'team:remove_member')).toBe(true);
      expect(hasPermission('admin', 'content:approve')).toBe(true);
    });

    it('editor can create and edit content but cannot approve', () => {
      expect(hasPermission('editor', 'content:create')).toBe(true);
      expect(hasPermission('editor', 'content:edit')).toBe(true);
      expect(hasPermission('editor', 'content:approve')).toBe(false);
      expect(hasPermission('editor', 'content:publish')).toBe(false);
    });

    it('viewer can only view analytics', () => {
      expect(hasPermission('viewer', 'analytics:view')).toBe(true);
      expect(hasPermission('viewer', 'content:create')).toBe(false);
      expect(hasPermission('viewer', 'content:edit')).toBe(false);
      expect(hasPermission('viewer', 'team:invite')).toBe(false);
    });
  });

  describe('getPermissionsForRole', () => {
    it('returns array of permissions for each role', () => {
      const ownerPerms = getPermissionsForRole('owner');
      expect(ownerPerms.length).toBeGreaterThan(0);
      expect(ownerPerms).toContain('billing:manage');

      const viewerPerms = getPermissionsForRole('viewer');
      expect(viewerPerms).toEqual(['analytics:view']);
    });

    it('returns empty array for invalid role', () => {
      expect(getPermissionsForRole('unknown' as TeamRole)).toEqual([]);
    });
  });

  describe('canManageRole', () => {
    it('owner can manage all other roles', () => {
      expect(canManageRole('owner', 'admin')).toBe(true);
      expect(canManageRole('owner', 'editor')).toBe(true);
      expect(canManageRole('owner', 'viewer')).toBe(true);
    });

    it('admin can manage editor and viewer', () => {
      expect(canManageRole('admin', 'editor')).toBe(true);
      expect(canManageRole('admin', 'viewer')).toBe(true);
    });

    it('admin cannot manage owner or other admins', () => {
      expect(canManageRole('admin', 'owner')).toBe(false);
      expect(canManageRole('admin', 'admin')).toBe(false);
    });

    it('editor can only manage viewer', () => {
      expect(canManageRole('editor', 'viewer')).toBe(true);
      expect(canManageRole('editor', 'editor')).toBe(false);
      expect(canManageRole('editor', 'admin')).toBe(false);
    });

    it('viewer cannot manage anyone', () => {
      expect(canManageRole('viewer', 'viewer')).toBe(false);
    });
  });

  describe('canAccessBusiness', () => {
    it('owner always has access', () => {
      const ctx: TeamContext = { teamId: 't1', userId: 'u1', role: 'owner', businessIds: [] };
      expect(canAccessBusiness(ctx, 'any-business')).toBe(true);
    });

    it('admin always has access', () => {
      const ctx: TeamContext = { teamId: 't1', userId: 'u1', role: 'admin', businessIds: ['biz-1'] };
      expect(canAccessBusiness(ctx, 'biz-99')).toBe(true);
    });

    it('editor with empty businessIds has access to all', () => {
      const ctx: TeamContext = { teamId: 't1', userId: 'u1', role: 'editor', businessIds: [] };
      expect(canAccessBusiness(ctx, 'any-business')).toBe(true);
    });

    it('editor with specific businessIds can only access listed businesses', () => {
      const ctx: TeamContext = { teamId: 't1', userId: 'u1', role: 'editor', businessIds: ['biz-1', 'biz-2'] };
      expect(canAccessBusiness(ctx, 'biz-1')).toBe(true);
      expect(canAccessBusiness(ctx, 'biz-2')).toBe(true);
      expect(canAccessBusiness(ctx, 'biz-3')).toBe(false);
    });

    it('viewer with specific businessIds can only access listed businesses', () => {
      const ctx: TeamContext = { teamId: 't1', userId: 'u1', role: 'viewer', businessIds: ['biz-1'] };
      expect(canAccessBusiness(ctx, 'biz-1')).toBe(true);
      expect(canAccessBusiness(ctx, 'biz-2')).toBe(false);
    });
  });
});
