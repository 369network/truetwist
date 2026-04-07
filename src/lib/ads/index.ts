export { AdPlatformAdapter } from "./ad-platform-adapter";
export { AdAccountManager } from "./ad-account-manager";
export { AdSyncService } from "./ad-sync-service";
export { AdWaterfallService } from "./ad-waterfall-service";
export { AdPositionTestService } from "./ad-position-test-service";
export { AdFrequencyService } from "./ad-frequency-service";
export { AdRevenueService } from "./ad-revenue-service";
export { MetaAdsAdapter } from "./platforms/meta-ads-adapter";
export { GoogleAdsAdapter } from "./platforms/google-ads-adapter";
export { TikTokAdsAdapter } from "./platforms/tiktok-ads-adapter";
export type {
  AdPlatform,
  AdOAuthConfig,
  AdOAuthTokens,
  AdRateLimitConfig,
  CampaignInput,
  CampaignResult,
  CampaignUpdate,
  CampaignObjective,
  CampaignStatus,
  AdSetInput,
  AdSetResult,
  AudienceTargeting,
  AdCreativeInput,
  AdInput,
  AdResult,
  AdFormat,
  AdPerformanceMetric,
  DateRange,
  AdAccountInfo,
} from "./types";
export { AD_PLATFORMS, AD_PLATFORM_RATE_LIMITS } from "./types";
