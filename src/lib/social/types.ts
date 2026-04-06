import { z } from "zod";

// ============================================
// Platform Types
// ============================================

export const PLATFORMS = [
  "instagram",
  "facebook",
  "twitter",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "threads",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PlatformSchema = z.enum(PLATFORMS);

// ============================================
// OAuth2 Types
// ============================================

export interface OAuthConfig {
  platform: Platform;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri: string;
  /** Whether to use PKCE (Twitter/X requires this) */
  usePKCE?: boolean;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
  tokenType: string;
  /** Platform-specific extra fields (e.g. page tokens) */
  metadata?: Record<string, unknown>;
}

export interface EncryptedTokens {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  expiresAt: Date | null;
}

// ============================================
// Content Types
// ============================================

export type MediaType = "image" | "video" | "gif" | "document";

export interface PostMedia {
  url: string;
  type: MediaType;
  altText?: string;
  /** Mime type, e.g. "image/jpeg" */
  mimeType?: string;
  /** File size in bytes */
  sizeBytes?: number;
}

export interface PostContent {
  text: string;
  media?: PostMedia[];
  hashtags?: string[];
  link?: string;
  /** Platform-specific overrides */
  platformOverrides?: Partial<Record<Platform, Partial<PostContent>>>;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  platformPostUrl?: string;
  error?: string;
  /** Platform-specific response data */
  rawResponse?: unknown;
}

// ============================================
// Platform Constraints
// ============================================

export interface PlatformConstraints {
  maxTextLength: number;
  maxHashtags: number;
  maxImages: number;
  maxVideoSizeBytes: number;
  maxImageSizeBytes: number;
  supportedImageFormats: string[];
  supportedVideoFormats: string[];
  /** Aspect ratios as "width:height" strings */
  supportedAspectRatios?: string[];
}

export const PLATFORM_CONSTRAINTS: Record<Platform, PlatformConstraints> = {
  instagram: {
    maxTextLength: 2200,
    maxHashtags: 30,
    maxImages: 10,
    maxVideoSizeBytes: 1024 * 1024 * 1024, // 1GB
    maxImageSizeBytes: 8 * 1024 * 1024, // 8MB
    supportedImageFormats: ["image/jpeg", "image/png"],
    supportedVideoFormats: ["video/mp4"],
    supportedAspectRatios: ["4:5", "1:1", "1.91:1", "9:16"],
  },
  facebook: {
    maxTextLength: 63206,
    maxHashtags: 30,
    maxImages: 10,
    maxVideoSizeBytes: 10 * 1024 * 1024 * 1024, // 10GB
    maxImageSizeBytes: 10 * 1024 * 1024, // 10MB
    supportedImageFormats: ["image/jpeg", "image/png", "image/gif"],
    supportedVideoFormats: ["video/mp4", "video/mov"],
  },
  twitter: {
    maxTextLength: 280,
    maxHashtags: 10,
    maxImages: 4,
    maxVideoSizeBytes: 512 * 1024 * 1024, // 512MB
    maxImageSizeBytes: 5 * 1024 * 1024, // 5MB
    supportedImageFormats: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    supportedVideoFormats: ["video/mp4"],
  },
  linkedin: {
    maxTextLength: 3000,
    maxHashtags: 30,
    maxImages: 9,
    maxVideoSizeBytes: 5 * 1024 * 1024 * 1024, // 5GB
    maxImageSizeBytes: 10 * 1024 * 1024, // 10MB
    supportedImageFormats: ["image/jpeg", "image/png", "image/gif"],
    supportedVideoFormats: ["video/mp4"],
  },
  tiktok: {
    maxTextLength: 2200,
    maxHashtags: 30,
    maxImages: 35,
    maxVideoSizeBytes: 4 * 1024 * 1024 * 1024, // 4GB
    maxImageSizeBytes: 20 * 1024 * 1024, // 20MB
    supportedImageFormats: ["image/jpeg", "image/png"],
    supportedVideoFormats: ["video/mp4", "video/webm"],
  },
  youtube: {
    maxTextLength: 5000,
    maxHashtags: 15,
    maxImages: 0,
    maxVideoSizeBytes: 256 * 1024 * 1024 * 1024, // 256GB
    maxImageSizeBytes: 2 * 1024 * 1024, // 2MB (thumbnail)
    supportedImageFormats: ["image/jpeg", "image/png"],
    supportedVideoFormats: ["video/mp4", "video/mov", "video/avi", "video/wmv"],
  },
  pinterest: {
    maxTextLength: 500,
    maxHashtags: 20,
    maxImages: 5,
    maxVideoSizeBytes: 2 * 1024 * 1024 * 1024, // 2GB
    maxImageSizeBytes: 32 * 1024 * 1024, // 32MB
    supportedImageFormats: ["image/jpeg", "image/png"],
    supportedVideoFormats: ["video/mp4"],
    supportedAspectRatios: ["2:3", "1:1"],
  },
  threads: {
    maxTextLength: 500,
    maxHashtags: 30,
    maxImages: 10,
    maxVideoSizeBytes: 1024 * 1024 * 1024, // 1GB
    maxImageSizeBytes: 8 * 1024 * 1024, // 8MB
    supportedImageFormats: ["image/jpeg", "image/png"],
    supportedVideoFormats: ["video/mp4"],
  },
};

// ============================================
// Rate Limit Types
// ============================================

export interface RateLimitConfig {
  /** Max requests in the time window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Human-readable description */
  description: string;
}

export const PLATFORM_RATE_LIMITS: Record<Platform, RateLimitConfig> = {
  instagram: { maxRequests: 25, windowSeconds: 3600, description: "25 publishes/hour" },
  facebook: { maxRequests: 4800, windowSeconds: 86400, description: "4800 calls/24h" },
  twitter: { maxRequests: 300, windowSeconds: 10800, description: "300 tweets/3h" },
  linkedin: { maxRequests: 100, windowSeconds: 86400, description: "100 calls/day" },
  tiktok: { maxRequests: 3, windowSeconds: 86400, description: "3 videos/day" },
  youtube: { maxRequests: 6, windowSeconds: 86400, description: "~6 uploads/day (10K quota units)" },
  pinterest: { maxRequests: 300, windowSeconds: 3600, description: "300 writes/hour" },
  threads: { maxRequests: 500, windowSeconds: 86400, description: "500 posts/24h" },
};

// ============================================
// Profile Types
// ============================================

export interface PlatformProfile {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  followerCount?: number;
}

// ============================================
// Analytics Types
// ============================================

export interface PostAnalytics {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  engagementRate: number;
  fetchedAt: Date;
}

// ============================================
// Scheduling Types
// ============================================

export interface ScheduleOptions {
  scheduledFor: Date;
  timezone: string;
  isPriority?: boolean;
}

export interface PostJob {
  postPlatformId: string;
  userId: string;
  socialAccountId: string;
  platform: Platform;
  content: PostContent;
  schedule?: ScheduleOptions;
}
