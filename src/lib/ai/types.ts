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
