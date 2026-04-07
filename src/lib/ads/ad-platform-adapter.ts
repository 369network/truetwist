import type {
  AdPlatform,
  AdOAuthConfig,
  AdOAuthTokens,
  AdRateLimitConfig,
  CampaignInput,
  CampaignResult,
  CampaignUpdate,
  AdSetInput,
  AdSetResult,
  AdInput,
  AdResult,
  AdPerformanceMetric,
  DateRange,
  AdAccountInfo,
} from "./types";

/**
 * Abstract base class for all ad platform adapters.
 * Mirrors the social PlatformAdapter pattern but specialized for ad APIs.
 */
export abstract class AdPlatformAdapter {
  abstract readonly platform: AdPlatform;
  abstract readonly rateLimitConfig: AdRateLimitConfig;

  // ---- OAuth ----

  abstract getAdOAuthConfig(): AdOAuthConfig;

  abstract exchangeAdCodeForTokens(code: string): Promise<AdOAuthTokens>;

  abstract refreshAdAccessToken(
    refreshToken: string
  ): Promise<AdOAuthTokens | null>;

  // ---- Account ----

  abstract getAdAccountInfo(accessToken: string): Promise<AdAccountInfo>;

  // ---- Campaign CRUD ----

  abstract createCampaign(
    accessToken: string,
    campaign: CampaignInput
  ): Promise<CampaignResult>;

  abstract updateCampaign(
    accessToken: string,
    campaignId: string,
    updates: CampaignUpdate
  ): Promise<CampaignResult>;

  abstract pauseCampaign(
    accessToken: string,
    campaignId: string
  ): Promise<CampaignResult>;

  abstract resumeCampaign(
    accessToken: string,
    campaignId: string
  ): Promise<CampaignResult>;

  // ---- Ad Set ----

  abstract createAdSet(
    accessToken: string,
    adSet: AdSetInput
  ): Promise<AdSetResult>;

  // ---- Ad Creative ----

  abstract createAd(
    accessToken: string,
    ad: AdInput
  ): Promise<AdResult>;

  // ---- Metrics ----

  abstract fetchCampaignMetrics(
    accessToken: string,
    campaignId: string,
    dateRange: DateRange
  ): Promise<AdPerformanceMetric[]>;

  abstract fetchAdMetrics(
    accessToken: string,
    adId: string,
    dateRange: DateRange
  ): Promise<AdPerformanceMetric[]>;
}
