import type { Platform } from '@/lib/social/types';

// ============================================
// Content Generation Types
// ============================================

export type GenerationType = 'text' | 'image' | 'video';

export type ContentTemplate =
  | 'educational'
  | 'promotional'
  | 'storytelling'
  | 'engagement'
  | 'announcement'
  | 'behind-the-scenes';

export type ImageStylePreset =
  | 'minimalist'
  | 'bold'
  | 'elegant'
  | 'playful'
  | 'corporate';

export type ImageTemplate =
  | 'quote-graphic'
  | 'product-showcase'
  | 'infographic'
  | 'carousel-slide'
  | 'social-post';

export type VideoTemplate =
  | 'text-animation'
  | 'product-showcase'
  | 'talking-head'
  | 'slideshow'
  | 'before-after'
  | 'testimonial'
  | 'stat-reveal'
  | 'tip-carousel';

export type VideoAspectRatio = '9:16' | '16:9' | '1:1';

// ============================================
// Brand Context
// ============================================

export interface BrandContext {
  businessName: string;
  industry?: string;
  description?: string;
  brandVoice?: string;
  targetAudience?: Record<string, unknown>;
  colors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  logoUrl?: string;
}

// ============================================
// Text Generation
// ============================================

export interface TextGenerationRequest {
  userId: string;
  businessId: string;
  prompt: string;
  platforms: Platform[];
  template?: ContentTemplate;
  tone?: string;
  includeHashtags?: boolean;
  variantCount?: number; // default 3
  threadMode?: boolean; // for multi-part content
}

export interface TextVariant {
  text: string;
  hashtags: string[];
  platform: Platform;
  characterCount: number;
}

export interface TextGenerationResult {
  variants: TextVariant[];
  model: string;
  tokensInput: number;
  tokensOutput: number;
  costCents: number;
  durationMs: number;
}

// ============================================
// Image Generation
// ============================================

export interface ImageGenerationRequest {
  userId: string;
  businessId: string;
  prompt: string;
  platform: Platform;
  template?: ImageTemplate;
  style?: ImageStylePreset;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  count?: number; // default 1, max 4
}

export interface GeneratedImage {
  url: string;
  revisedPrompt: string;
  size: string;
}

export interface ImageGenerationResult {
  images: GeneratedImage[];
  model: string;
  costCents: number;
  durationMs: number;
}

// ============================================
// Video Generation
// ============================================

export interface VideoGenerationRequest {
  userId: string;
  businessId: string;
  prompt: string;
  platform: Platform;
  template?: VideoTemplate;
  aspectRatio?: VideoAspectRatio;
  durationSeconds?: number; // 5-60 with pipeline, 5-15 for foundation
  script?: string;
}

export interface VideoPreviewInfo {
  jobId: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  platform: string;
  status: string;
  platformPreviews: Array<{
    platform: string;
    aspectRatio: VideoAspectRatio;
    width: number;
    height: number;
  }>;
}

export interface GeneratedVideo {
  url: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
}

export interface VideoGenerationResult {
  video: GeneratedVideo;
  model: string;
  costCents: number;
  durationMs: number;
}

// ============================================
// Credit System
// ============================================

export interface PlanCredits {
  textGenerations: number;
  imageGenerations: number;
  videoGenerations: number;
}

export const PLAN_CREDITS: Record<string, PlanCredits> = {
  free: { textGenerations: 10, imageGenerations: 5, videoGenerations: 2 },
  starter: { textGenerations: 100, imageGenerations: 50, videoGenerations: 10 },
  pro: { textGenerations: 500, imageGenerations: 200, videoGenerations: 50 },
  enterprise: { textGenerations: -1, imageGenerations: -1, videoGenerations: -1 }, // unlimited
};

export interface CreditUsage {
  used: number;
  limit: number;
  remaining: number;
}

export interface UserCredits {
  text: CreditUsage;
  image: CreditUsage;
  video: CreditUsage;
  periodStart: Date;
  periodEnd: Date;
}

// ============================================
// Generation History
// ============================================

export interface GenerationHistoryEntry {
  id: string;
  type: GenerationType;
  prompt: string;
  model: string;
  outputText?: string;
  outputMediaUrl?: string;
  costCents: number;
  createdAt: Date;
}

// ============================================
// Ad Platform Types
// ============================================

export type AdPlatform = 'meta' | 'google' | 'tiktok';

export type AdObjective =
  | 'conversions'
  | 'awareness'
  | 'engagement'
  | 'traffic'
  | 'app_installs';

// ============================================
// Ad Budget Allocation
// ============================================

export interface AdPerformanceMetric {
  platform: AdPlatform;
  campaignId?: string;
  campaignName?: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  roas: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface AdBudgetAllocationRequest {
  userId: string;
  businessId: string;
  totalBudget: number;
  platforms: AdPlatform[];
  historicalMetrics: AdPerformanceMetric[];
  objective: AdObjective;
  constraints?: {
    minPerPlatformPct?: number;
    maxPerPlatformPct?: number;
  };
}

export interface PlatformAllocation {
  platform: AdPlatform;
  campaignId?: string;
  recommendedBudgetPct: number;
  recommendedBudgetAmount: number;
  confidence: number;
  reasoning: string;
}

export interface AdBudgetAllocationResult {
  allocations: PlatformAllocation[];
  totalProjectedRoas: number;
  insights: string[];
  model: string;
  tokensInput: number;
  tokensOutput: number;
  costCents: number;
  durationMs: number;
}

// ============================================
// Ad Creative Generation
// ============================================

export interface AdCreativeRequest {
  userId: string;
  businessId: string;
  platform: AdPlatform;
  objective: AdObjective;
  productOrService: string;
  targetAudience?: string;
  campaignTheme?: string;
  cta?: string;
  variantCount?: number;
}

export interface MetaAdCreative {
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
}

export interface GoogleRsaCreative {
  headlines: string[];
  descriptions: string[];
}

export interface TikTokAdCreative {
  overlayText: string;
  caption: string;
  cta: string;
}

export interface AdCreativeVariant {
  platform: AdPlatform;
  creative: MetaAdCreative | GoogleRsaCreative | TikTokAdCreative;
  scores: {
    novelty: number;
    clarity: number;
    ctaStrength: number;
    overall: number;
  };
  recommendation: string;
}

export interface AdCreativeResult {
  variants: AdCreativeVariant[];
  model: string;
  tokensInput: number;
  tokensOutput: number;
  costCents: number;
  durationMs: number;
}
