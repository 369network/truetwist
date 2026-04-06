import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer']),
});

export const updateMemberBusinessAccessSchema = z.object({
  businessIds: z.array(z.string().uuid()),
});

export const submitForReviewSchema = z.object({
  postId: z.string().uuid(),
});

export const reviewPostSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(1000).optional(),
});

export const postCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
  mentions: z.array(z.string().uuid()).default([]),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type ReviewPostInput = z.infer<typeof reviewPostSchema>;
export type PostCommentInput = z.infer<typeof postCommentSchema>;
