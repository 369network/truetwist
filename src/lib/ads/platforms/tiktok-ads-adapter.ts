import { AdPlatformAdapter } from "../ad-platform-adapter";
import {
  AD_PLATFORM_RATE_LIMITS,
  type AdOAuthConfig,
  type AdOAuthTokens,
  type AdRateLimitConfig,
  type CampaignInput,
  type CampaignResult,
  type CampaignUpdate,
  type AdSetInput,
  type AdSetResult,
  type AdInput,
  type AdResult,
  type AdPerformanceMetric,
  type DateRange,
  type AdAccountInfo,
  type AdPlatform,
} from "../types";

const TIKTOK_ADS_API = "https://business-api.tiktok.com/open_api/v1.3";

/**
 * TikTok Marketing API v1.3 adapter.
 *
 * Supports spark ads, in-feed ads, TopView.
 * Reporting via async report generation endpoint.
 */
export class TikTokAdsAdapter extends AdPlatformAdapter {
  readonly platform: AdPlatform = "tiktok";
  readonly rateLimitConfig: AdRateLimitConfig = AD_PLATFORM_RATE_LIMITS.tiktok;

  private advertiserId: string;

  constructor(advertiserId: string) {
    super();
    this.advertiserId = advertiserId;
  }

  private getHeaders(accessToken: string): Record<string, string> {
    return {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    };
  }

  // ---- OAuth ----

  getAdOAuthConfig(): AdOAuthConfig {
    return {
      platform: "tiktok",
      clientId: process.env.TIKTOK_ADS_APP_ID!,
      clientSecret: process.env.TIKTOK_ADS_SECRET!,
      authorizationUrl:
        "https://business-api.tiktok.com/portal/auth?app_id=" +
        process.env.TIKTOK_ADS_APP_ID,
      tokenUrl: `${TIKTOK_ADS_API}/oauth2/access_token/`,
      scopes: [],
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/auth/callback/tiktok-ads`,
    };
  }

  async exchangeAdCodeForTokens(code: string): Promise<AdOAuthTokens> {
    const config = this.getAdOAuthConfig();

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: config.clientId,
        secret: config.clientSecret,
        auth_code: code,
      }),
    });

    if (!res.ok) {
      throw new Error(`TikTok token exchange failed: ${await res.text()}`);
    }

    const json = await res.json();
    if (json.code !== 0) {
      throw new Error(
        `TikTok token exchange error: ${json.message ?? JSON.stringify(json)}`
      );
    }

    const data = json.data;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.access_token_expires_in
        ? new Date(Date.now() + data.access_token_expires_in * 1000)
        : null,
      scopes: data.scope ? [data.scope].flat() : [],
      tokenType: "bearer",
      metadata: {
        advertiserIds: data.advertiser_ids ?? [],
      },
    };
  }

  async refreshAdAccessToken(
    refreshToken: string
  ): Promise<AdOAuthTokens | null> {
    const config = this.getAdOAuthConfig();

    const res = await fetch(
      `${TIKTOK_ADS_API}/oauth2/refresh_token/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: config.clientId,
          secret: config.clientSecret,
          refresh_token: refreshToken,
        }),
      }
    );

    if (!res.ok) return null;

    const json = await res.json();
    if (json.code !== 0) return null;

    const data = json.data;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.access_token_expires_in
        ? new Date(Date.now() + data.access_token_expires_in * 1000)
        : null,
      scopes: [],
      tokenType: "bearer",
    };
  }

  // ---- Account ----

  async getAdAccountInfo(accessToken: string): Promise<AdAccountInfo> {
    const params = new URLSearchParams({
      advertiser_ids: JSON.stringify([this.advertiserId]),
    });

    const res = await this.adFetch(this.advertiserId,
      `${TIKTOK_ADS_API}/advertiser/info/?${params}`,
      { headers: this.getHeaders(accessToken) }
    );

    if (!res.ok) {
      throw new Error(`TikTok getAdAccountInfo failed: ${await res.text()}`);
    }

    const json = await res.json();
    if (json.code !== 0) {
      throw new Error(`TikTok API error: ${json.message}`);
    }

    const adv = json.data?.list?.[0];
    if (!adv) throw new Error("No advertiser data returned");

    const statusMap: Record<string, AdAccountInfo["status"]> = {
      STATUS_ENABLE: "active",
      STATUS_DISABLE: "disabled",
      STATUS_PENDING_CONFIRM: "pending_review",
    };

    return {
      platformAccountId: adv.advertiser_id,
      platform: "tiktok",
      name: adv.advertiser_name ?? "",
      currency: adv.currency ?? "USD",
      timezone: adv.timezone ?? "UTC",
      status: statusMap[adv.status] ?? "disabled",
    };
  }

  // ---- Campaign CRUD ----

  async createCampaign(
    accessToken: string,
    campaign: CampaignInput
  ): Promise<CampaignResult> {
    const objectiveMap: Record<string, string> = {
      awareness: "REACH",
      traffic: "TRAFFIC",
      engagement: "VIDEO_VIEWS",
      leads: "LEAD_GENERATION",
      app_promotion: "APP_PROMOTION",
      sales: "WEB_CONVERSIONS",
      conversions: "WEB_CONVERSIONS",
    };

    const body: Record<string, unknown> = {
      advertiser_id: this.advertiserId,
      campaign_name: campaign.name,
      objective_type: objectiveMap[campaign.objective] ?? "REACH",
      budget_mode: campaign.lifetimeBudgetCents ? "BUDGET_MODE_TOTAL" : "BUDGET_MODE_DAY",
      budget: campaign.lifetimeBudgetCents
        ? campaign.lifetimeBudgetCents / 100
        : campaign.dailyBudgetCents / 100,
      operation_status: "DISABLE",
    };

    const res = await this.adFetch(this.advertiserId, `${TIKTOK_ADS_API}/campaign/create/`, {
      method: "POST",
      headers: this.getHeaders(accessToken),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `TikTok createCampaign failed: ${await res.text()}`,
      };
    }

    const json = await res.json();
    if (json.code !== 0) {
      return { success: false, error: `TikTok API: ${json.message}` };
    }

    return {
      success: true,
      platformCampaignId: json.data?.campaign_id,
      rawResponse: json,
    };
  }

  async updateCampaign(
    accessToken: string,
    campaignId: string,
    updates: CampaignUpdate
  ): Promise<CampaignResult> {
    const body: Record<string, unknown> = {
      advertiser_id: this.advertiserId,
      campaign_id: campaignId,
    };

    if (updates.name) body.campaign_name = updates.name;
    if (updates.dailyBudgetCents) body.budget = updates.dailyBudgetCents / 100;
    if (updates.lifetimeBudgetCents)
      body.budget = updates.lifetimeBudgetCents / 100;

    const res = await this.adFetch(this.advertiserId, `${TIKTOK_ADS_API}/campaign/update/`, {
      method: "POST",
      headers: this.getHeaders(accessToken),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `TikTok updateCampaign failed: ${await res.text()}`,
      };
    }

    const json = await res.json();
    if (json.code !== 0) {
      return { success: false, error: `TikTok API: ${json.message}` };
    }

    return { success: true, platformCampaignId: campaignId };
  }

  async pauseCampaign(
    accessToken: string,
    campaignId: string
  ): Promise<CampaignResult> {
    const res = await this.adFetch(this.advertiserId,
      `${TIKTOK_ADS_API}/campaign/status/update/`,
      {
        method: "POST",
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({
          advertiser_id: this.advertiserId,
          campaign_ids: [campaignId],
          opt_status: "DISABLE",
        }),
      }
    );

    if (!res.ok) {
      return {
        success: false,
        error: `TikTok pauseCampaign failed: ${await res.text()}`,
      };
    }

    const json = await res.json();
    if (json.code !== 0) {
      return { success: false, error: `TikTok API: ${json.message}` };
    }

    return { success: true, platformCampaignId: campaignId };
  }

  async resumeCampaign(
    accessToken: string,
    campaignId: string
  ): Promise<CampaignResult> {
    const res = await this.adFetch(this.advertiserId,
      `${TIKTOK_ADS_API}/campaign/status/update/`,
      {
        method: "POST",
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({
          advertiser_id: this.advertiserId,
          campaign_ids: [campaignId],
          opt_status: "ENABLE",
        }),
      }
    );

    if (!res.ok) {
      return {
        success: false,
        error: `TikTok resumeCampaign failed: ${await res.text()}`,
      };
    }

    const json = await res.json();
    if (json.code !== 0) {
      return { success: false, error: `TikTok API: ${json.message}` };
    }

    return { success: true, platformCampaignId: campaignId };
  }

  // ---- Ad Set (Ad Group in TikTok) ----

  async createAdSet(
    accessToken: string,
    adSet: AdSetInput
  ): Promise<AdSetResult> {
    const body: Record<string, unknown> = {
      advertiser_id: this.advertiserId,
      campaign_id: adSet.campaignId,
      adgroup_name: adSet.name,
      placement_type: "PLACEMENT_TYPE_AUTOMATIC",
      budget_mode: adSet.dailyBudgetCents
        ? "BUDGET_MODE_DAY"
        : "BUDGET_MODE_TOTAL",
      budget: adSet.dailyBudgetCents
        ? adSet.dailyBudgetCents / 100
        : 0,
      billing_event: "CPC",
      optimization_goal: "CLICK",
      operation_status: "DISABLE",
    };

    // Targeting
    if (adSet.targeting.ageMin || adSet.targeting.ageMax) {
      body.age_groups = this.mapAgeGroups(
        adSet.targeting.ageMin,
        adSet.targeting.ageMax
      );
    }
    if (adSet.targeting.genders?.length) {
      const genderMap: Record<string, string> = {
        male: "GENDER_MALE",
        female: "GENDER_FEMALE",
        all: "GENDER_UNLIMITED",
      };
      body.gender =
        adSet.targeting.genders.includes("all")
          ? "GENDER_UNLIMITED"
          : genderMap[adSet.targeting.genders[0]] ?? "GENDER_UNLIMITED";
    }
    if (adSet.targeting.locations?.length) {
      body.location_ids = adSet.targeting.locations.map((l) => l.value);
    }
    if (adSet.targeting.interests?.length) {
      body.interest_category_ids = adSet.targeting.interests;
    }
    if (adSet.targeting.languages?.length) {
      body.languages = adSet.targeting.languages;
    }

    if (adSet.bidAmountCents) {
      body.bid_price = adSet.bidAmountCents / 100;
    }
    if (adSet.startDate) {
      body.schedule_start_time = adSet.startDate.toISOString().replace("T", " ").slice(0, 19);
    }
    if (adSet.endDate) {
      body.schedule_end_time = adSet.endDate.toISOString().replace("T", " ").slice(0, 19);
      body.schedule_type = "SCHEDULE_START_END";
    } else {
      body.schedule_type = "SCHEDULE_FROM_NOW";
    }

    const res = await this.adFetch(this.advertiserId, `${TIKTOK_ADS_API}/adgroup/create/`, {
      method: "POST",
      headers: this.getHeaders(accessToken),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `TikTok createAdGroup failed: ${await res.text()}`,
      };
    }

    const json = await res.json();
    if (json.code !== 0) {
      return { success: false, error: `TikTok API: ${json.message}` };
    }

    return {
      success: true,
      platformAdSetId: json.data?.adgroup_id,
      rawResponse: json,
    };
  }

  private mapAgeGroups(
    ageMin?: number,
    ageMax?: number
  ): string[] {
    const allGroups = [
      { id: "AGE_13_17", min: 13, max: 17 },
      { id: "AGE_18_24", min: 18, max: 24 },
      { id: "AGE_25_34", min: 25, max: 34 },
      { id: "AGE_35_44", min: 35, max: 44 },
      { id: "AGE_45_54", min: 45, max: 54 },
      { id: "AGE_55_100", min: 55, max: 100 },
    ];

    return allGroups
      .filter(
        (g) =>
          (!ageMin || g.max >= ageMin) && (!ageMax || g.min <= ageMax)
      )
      .map((g) => g.id);
  }

  // ---- Ad Creative ----

  async createAd(accessToken: string, ad: AdInput): Promise<AdResult> {
    const body: Record<string, unknown> = {
      advertiser_id: this.advertiserId,
      adgroup_id: ad.adSetId,
      creatives: [
        {
          ad_name: ad.name,
          ad_text: ad.creative.body ?? "",
          call_to_action: ad.creative.callToAction ?? "LEARN_MORE",
          landing_page_url: ad.creative.destinationUrl ?? "",
          ...(ad.creative.format === "spark_ad" && ad.creative.metadata?.tiktokPostId
            ? {
                tiktok_item_id: ad.creative.metadata.tiktokPostId,
                identity_type: "CUSTOMIZED_USER",
              }
            : {}),
          ...(ad.creative.mediaUrls?.length
            ? { video_id: ad.creative.mediaUrls[0] }
            : {}),
          ...(ad.creative.thumbnailUrl
            ? { image_ids: [ad.creative.thumbnailUrl] }
            : {}),
        },
      ],
    };

    const res = await this.adFetch(this.advertiserId, `${TIKTOK_ADS_API}/ad/create/`, {
      method: "POST",
      headers: this.getHeaders(accessToken),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `TikTok createAd failed: ${await res.text()}`,
      };
    }

    const json = await res.json();
    if (json.code !== 0) {
      return { success: false, error: `TikTok API: ${json.message}` };
    }

    const adIds = json.data?.ad_ids ?? [];
    return {
      success: true,
      platformAdId: adIds[0],
      rawResponse: json,
    };
  }

  // ---- Metrics (async report) ----

  async fetchCampaignMetrics(
    accessToken: string,
    campaignId: string,
    dateRange: DateRange
  ): Promise<AdPerformanceMetric[]> {
    return this.fetchReport(
      accessToken,
      campaignId,
      "campaign",
      dateRange
    );
  }

  async fetchAdMetrics(
    accessToken: string,
    adId: string,
    dateRange: DateRange
  ): Promise<AdPerformanceMetric[]> {
    return this.fetchReport(accessToken, adId, "ad", dateRange);
  }

  private async fetchReport(
    accessToken: string,
    entityId: string,
    entityType: "campaign" | "ad",
    dateRange: DateRange
  ): Promise<AdPerformanceMetric[]> {
    const dataLevel =
      entityType === "campaign"
        ? "AUCTION_CAMPAIGN"
        : "AUCTION_AD";
    const filterField =
      entityType === "campaign" ? "campaign_ids" : "ad_ids";

    const body = {
      advertiser_id: this.advertiserId,
      report_type: "BASIC",
      data_level: dataLevel,
      dimensions: ["stat_time_day"],
      metrics: [
        "spend",
        "impressions",
        "reach",
        "clicks",
        "conversion",
        "cpc",
        "ctr",
        "cost_per_conversion",
        "conversion_rate",
      ],
      start_date: dateRange.start.toISOString().split("T")[0],
      end_date: dateRange.end.toISOString().split("T")[0],
      filtering: {
        [filterField]: [entityId],
      },
      page: 1,
      page_size: 365,
    };

    const res = await this.adFetch(this.advertiserId,
      `${TIKTOK_ADS_API}/report/integrated/get/`,
      {
        method: "POST",
        headers: this.getHeaders(accessToken),
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      throw new Error(`TikTok report failed: ${await res.text()}`);
    }

    const json = await res.json();
    if (json.code !== 0) {
      throw new Error(`TikTok report error: ${json.message}`);
    }

    const now = new Date();
    return (json.data?.list ?? []).map(
      (row: Record<string, unknown>): AdPerformanceMetric => {
        const dims = row.dimensions as Record<string, string>;
        const m = row.metrics as Record<string, string>;
        const impressions = Number(m.impressions ?? 0);
        const clicks = Number(m.clicks ?? 0);
        const spend = Number(m.spend ?? 0);
        const conversions = Number(m.conversion ?? 0);

        return {
          platform: "tiktok",
          entityType: entityType === "campaign" ? "campaign" : "ad",
          entityId,
          date: new Date(dims.stat_time_day),
          impressions,
          reach: Number(m.reach ?? 0),
          clicks,
          spend,
          conversions,
          costPerClick: Number(m.cpc ?? 0),
          costPerConversion: Number(m.cost_per_conversion ?? 0),
          clickThroughRate: Number(m.ctr ?? 0) * 100,
          conversionRate: Number(m.conversion_rate ?? 0) * 100,
          returnOnAdSpend: 0,
          platformSpecific: { rawMetrics: m },
          fetchedAt: now,
        };
      }
    );
  }
}
