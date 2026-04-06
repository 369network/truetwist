import { z } from 'zod';
import { PLATFORMS } from '@/lib/social/types';

export const createCompetitorSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  name: z.string().min(1, 'Competitor name is required').max(255),
  websiteUrl: z.string().url().optional().nullable(),
  accounts: z.array(z.object({
    platform: z.enum(PLATFORMS),
    handle: z.string().min(1, 'Handle is required').max(255),
    profileUrl: z.string().url().optional().nullable(),
  })).optional(),
});

export const updateCompetitorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  websiteUrl: z.string().url().optional().nullable(),
});

export const addCompetitorAccountSchema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1, 'Handle is required').max(255),
  profileUrl: z.string().url().optional().nullable(),
});

export const alertQuerySchema = z.object({
  alertType: z.enum(['viral_post', 'strategy_change', 'follower_spike', 'new_competitor']).optional(),
  unreadOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const markAlertsReadSchema = z.object({
  alertIds: z.array(z.string().uuid()).min(1),
});

export type CreateCompetitorInput = z.infer<typeof createCompetitorSchema>;
export type UpdateCompetitorInput = z.infer<typeof updateCompetitorSchema>;
export type AddCompetitorAccountInput = z.infer<typeof addCompetitorAccountSchema>;
