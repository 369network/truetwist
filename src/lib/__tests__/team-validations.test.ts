import { describe, it, expect } from 'vitest';
import {
  createTeamSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  reviewPostSchema,
  postCommentSchema,
} from '@/lib/team-validations';

describe('team validations', () => {
  describe('createTeamSchema', () => {
    it('accepts valid team name', () => {
      const result = createTeamSchema.safeParse({ name: 'My Team' });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = createTeamSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects name over 100 characters', () => {
      const result = createTeamSchema.safeParse({ name: 'x'.repeat(101) });
      expect(result.success).toBe(false);
    });
  });

  describe('inviteMemberSchema', () => {
    it('accepts valid invite', () => {
      const result = inviteMemberSchema.safeParse({ email: 'test@example.com', role: 'editor' });
      expect(result.success).toBe(true);
    });

    it('defaults role to viewer', () => {
      const result = inviteMemberSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('viewer');
      }
    });

    it('rejects invalid email', () => {
      const result = inviteMemberSchema.safeParse({ email: 'not-an-email', role: 'editor' });
      expect(result.success).toBe(false);
    });

    it('rejects owner role', () => {
      const result = inviteMemberSchema.safeParse({ email: 'test@example.com', role: 'owner' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateMemberRoleSchema', () => {
    it('accepts valid roles', () => {
      for (const role of ['admin', 'editor', 'viewer']) {
        const result = updateMemberRoleSchema.safeParse({ role });
        expect(result.success).toBe(true);
      }
    });

    it('rejects owner role', () => {
      const result = updateMemberRoleSchema.safeParse({ role: 'owner' });
      expect(result.success).toBe(false);
    });
  });

  describe('reviewPostSchema', () => {
    it('accepts approve action', () => {
      const result = reviewPostSchema.safeParse({ action: 'approve' });
      expect(result.success).toBe(true);
    });

    it('accepts reject with reason', () => {
      const result = reviewPostSchema.safeParse({ action: 'reject', reason: 'Needs more detail' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid action', () => {
      const result = reviewPostSchema.safeParse({ action: 'maybe' });
      expect(result.success).toBe(false);
    });
  });

  describe('postCommentSchema', () => {
    it('accepts valid comment', () => {
      const result = postCommentSchema.safeParse({ content: 'Looks good!' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mentions).toEqual([]);
      }
    });

    it('accepts comment with mentions', () => {
      const result = postCommentSchema.safeParse({
        content: 'Hey @user check this',
        mentions: ['550e8400-e29b-41d4-a716-446655440000'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty comment', () => {
      const result = postCommentSchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
    });

    it('rejects comment over 2000 characters', () => {
      const result = postCommentSchema.safeParse({ content: 'x'.repeat(2001) });
      expect(result.success).toBe(false);
    });
  });
});
