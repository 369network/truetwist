import { z } from 'zod';

export const hashtagRecommendationSchema = z.object({
  topic: z.string().min(1).max(500),
  platform: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional().default(30),
});

export const alertPreferencesSchema = z.object({
  businessId: z.string().uuid().nullable().optional(),
  nicheKeywords: z.array(z.string().max(100)).max(20).optional(),
  platforms: z.array(z.string()).max(10).optional(),
  minViralScore: z.number().min(0).max(100).optional(),
  alertTypes: z.array(z.enum(['trend_emerging', 'trend_peaking', 'niche_match', 'hashtag_trending'])).optional(),
  digestFrequency: z.enum(['realtime', 'daily', 'weekly']).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const markAlertsReadSchema = z.object({
  alertIds: z.array(z.string().uuid()).min(1).max(100),
});

export const triggerCollectionSchema = z.object({
  source: z.enum(['youtube', 'google_trends', 'twitter', 'tiktok', 'instagram']).optional(),
  region: z.string().min(2).max(5).optional().default('US'),
});

export const viralScoreSchema = z.object({
  engagements: z.number().min(0),
  followers: z.number().min(0),
  hours: z.number().min(0),
  acceleration: z.number(),
  shareRatio: z.number().min(0).max(1),
  nonFollowerReach: z.number().min(0),
  reachHours: z.number().min(0),
  platform: z.string(),
  contentFormat: z.string(),
  sentimentScore: z.number().min(-1).max(1),
  peakVelocity: z.number().min(0),
  currentVelocity: z.number().min(0),
  ageHours: z.number().min(0),
});
