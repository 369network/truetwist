import { z } from "zod";

// ============================================
// Ad Platform Types
// ============================================

export const AD_PLATFORMS = ["meta", "google", "tiktok"] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];
export const AdPlatformSchema = z.enum(AD_PLATFORMS);

// ============================================
// OAuth Types (Ad-Specific)
// ============================================

export interface AdOAuthConfig {
  platform: AdPlatform;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri: string;
}

export interface AdOAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
  tokenType: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Campaign Types
// ============================================

export const CAMPAIGN_OBJECTIVES = [
  "awareness",
  "traffic",
  "engagement",
  "leads",
  "app_promotion",
  "sales",
  "conversions",
] as const;
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const CAMPAIGN_STATUSES = [
  "active",
  "paused",
  "deleted",
  "archived",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface CampaignInput {
  name: string;
  objective: CampaignObjective;
  dailyBudgetCents: number;
  lifetimeBudgetCents?: number;
  startDate: Date;
  endDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface CampaignResult {
  success: boolean;
  platformCampaignId?: string;
  error?: string;
  rawResponse?: unknown;
}

export interface CampaignUpdate {
  name?: string;
  dailyBudgetCents?: number;
  lifetimeBudgetCents?: number;
  endDate?: Date;
  metadata?: Record<string, unknown>;
}

// ============================================
// Ad Set / Targeting Types
// ============================================

export interface AudienceTargeting {
  ageMin?: number;
  ageMax?: number;
  genders?: ("male" | "female" | "all")[];
  locations?: { type: "country" | "region" | "city"; value: string }[];
  interests?: string[];
  customAudiences?: string[];
  excludedAudiences?: string[];
  languages?: string[];
  placements?: string[];
}

export interface AdSetInput {
  name: string;
  campaignId: string;
  targeting: AudienceTargeting;
  dailyBudgetCents?: number;
  bidAmountCents?: number;
  bidStrategy?: "lowest_cost" | "cost_cap" | "bid_cap" | "target_cost";
  startDate?: Date;
  endDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface AdSetResult {
  success: boolean;
  platformAdSetId?: string;
  error?: string;
  rawResponse?: unknown;
}

// ============================================
// Ad Creative Types
// ============================================

export const AD_FORMATS = [
  "single_image",
  "single_video",
  "carousel",
  "responsive_search",
  "responsive_display",
  "spark_ad",
  "in_feed",
  "topview",
] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

export interface AdCreativeInput {
  name: string;
  format: AdFormat;
  headline?: string;
  body?: string;
  callToAction?: string;
  destinationUrl?: string;
  mediaUrls?: string[];
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AdInput {
  name: string;
  adSetId: string;
  creative: AdCreativeInput;
  metadata?: Record<string, unknown>;
}

export interface AdResult {
  success: boolean;
  platformAdId?: string;
  error?: string;
  rawResponse?: unknown;
}

// ============================================
// Metrics Types (Normalized)
// ============================================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AdPerformanceMetric {
  platform: AdPlatform;
  entityType: "campaign" | "ad_set" | "ad";
  entityId: string;
  date: Date;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  costPerClick: number;
  costPerConversion: number;
  clickThroughRate: number;
  conversionRate: number;
  returnOnAdSpend: number;
  platformSpecific?: Record<string, unknown>;
  fetchedAt: Date;
}

// ============================================
// Rate Limit Config for Ad Platforms
// ============================================

export interface AdRateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  description: string;
}

export const AD_PLATFORM_RATE_LIMITS: Record<AdPlatform, AdRateLimitConfig> = {
  meta: {
    maxRequests: 200,
    windowSeconds: 3600,
    description: "200 calls/hour/ad account",
  },
  google: {
    maxRequests: 1000,
    windowSeconds: 86400,
    description: "~1000 mutate ops/day (15K operations quota)",
  },
  tiktok: {
    maxRequests: 600,
    windowSeconds: 60,
    description: "600 requests/min",
  },
};

// ============================================
// Ad Account Types
// ============================================

export interface AdAccountInfo {
  platformAccountId: string;
  platform: AdPlatform;
  name: string;
  currency: string;
  timezone: string;
  status: "active" | "disabled" | "pending_review";
}
