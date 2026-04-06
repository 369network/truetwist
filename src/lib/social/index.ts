// Core types
export type {
  Platform,
  OAuthConfig,
  OAuthTokens,
  EncryptedTokens,
  PostContent,
  PostMedia,
  PublishResult,
  PostAnalytics,
  PlatformConstraints,
  RateLimitConfig,
  ScheduleOptions,
  PostJob,
  MediaType,
} from "./types";

export {
  PLATFORMS,
  PlatformSchema,
  PLATFORM_CONSTRAINTS,
  PLATFORM_RATE_LIMITS,
} from "./types";

// Adapter base class
export { PlatformAdapter } from "./platform-adapter";

// Platform registry
export {
  getPlatformAdapter,
  getAllAdapters,
  isPlatformSupported,
} from "./platforms";

// Services
export { OAuth2Manager, oauth2Manager } from "./oauth2-manager";
export { RateLimitManager } from "./rate-limit-manager";
export { PostingService } from "./posting-service";
export type { PostingServiceConfig } from "./posting-service";
export { AnalyticsService } from "./analytics-service";
export type { AnalyticsServiceConfig, AnalyticsJobData } from "./analytics-service";

// Token encryption
export { encryptToken, decryptToken } from "./token-encryption";
