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

const META_GRAPH_API = "https://graph.facebook.com/v21.0";

/**
 * Meta Marketing API v21.0 adapter.
 *
 * Supports campaign management, ad set targeting, ad creative submission,
 * and performance metrics via the Insights API.
 * Rate limit: 200 calls/hour/ad account — uses batch API where possible.
 */
export class MetaAdsAdapter extends AdPlatformAdapter {
  readonly platform: AdPlatform = "meta";
  readonly rateLimitConfig: AdRateLimitConfig = AD_PLATFORM_RATE_LIMITS.meta;

  private adAccountId: string;

  constructor(adAccountId: string) {
    super();
    this.adAccountId = adAccountId;
  }

  // ---- OAuth ----

  getAdOAuthConfig(): AdOAuthConfig {
    return {
      platform: "meta",
      clientId: process.env.META_ADS_CLIENT_ID!,
      clientSecret: process.env.META_ADS_CLIENT_SECRET!,
      authorizationUrl: "https://www.facebook.com/v21.0/dialog/oauth",
      tokenUrl: `${META_GRAPH_API}/oauth/access_token`,
      scopes: [
        "ads_management",
        "ads_read",
        "business_management",
        "read_insights",
      ],
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/auth/callback/meta-ads`,
    };
  }

  async exchangeAdCodeForTokens(code: string): Promise<AdOAuthTokens> {
    const config = this.getAdOAuthConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    });

    const res = await fetch(`${config.tokenUrl}?${params}`);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Meta token exchange failed: ${err}`);
    }

    const data = await res.json();

    // Exchange short-lived token for long-lived token
    const longLivedParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      fb_exchange_token: data.access_token,
    });

    const longRes = await fetch(`${config.tokenUrl}?${longLivedParams}`);
    if (!longRes.ok) {
      // Fall back to short-lived token
      return {
        accessToken: data.access_token,
        refreshToken: null,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : null,
        scopes: config.scopes,
        tokenType: data.token_type ?? "bearer",
      };
    }

    const longData = await longRes.json();
    return {
      accessToken: longData.access_token,
      refreshToken: null, // Meta uses long-lived tokens instead of refresh tokens
      expiresAt: longData.expires_in
        ? new Date(Date.now() + longData.expires_in * 1000)
        : null,
      scopes: config.scopes,
      tokenType: longData.token_type ?? "bearer",
    };
  }

  async refreshAdAccessToken(
    refreshToken: string
  ): Promise<AdOAuthTokens | null> {
    // Meta long-lived tokens are refreshed by exchanging the existing token
    const config = this.getAdOAuthConfig();
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      fb_exchange_token: refreshToken,
    });

    const res = await fetch(`${config.tokenUrl}?${params}`);
    if (!res.ok) return null;

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: null,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: config.scopes,
      tokenType: data.token_type ?? "bearer",
    };
  }

  // ---- Account ----

  async getAdAccountInfo(accessToken: string): Promise<AdAccountInfo> {
    const res = await this.adFetch(
      this.adAccountId,
      `${META_GRAPH_API}/act_${this.adAccountId}?fields=name,currency,timezone_name,account_status&access_token=${accessToken}`
    );
    if (!res.ok) {
      throw new Error(`Meta getAdAccountInfo failed: ${await res.text()}`);
    }

    const data = await res.json();
    const statusMap: Record<number, AdAccountInfo["status"]> = {
      1: "active",
      2: "disabled",
      3: "pending_review",
    };

    return {
      platformAccountId: data.id,
      platform: "meta",
      name: data.name,
      currency: data.currency,
      timezone: data.timezone_name,
      status: statusMap[data.account_status] ?? "disabled",
    };
  }

  // ---- Campaign CRUD ----

  async createCampaign(
    accessToken: string,
    campaign: CampaignInput
  ): Promise<CampaignResult> {
    const objectiveMap: Record<string, string> = {
      awareness: "OUTCOME_AWARENESS",
      traffic: "OUTCOME_TRAFFIC",
      engagement: "OUTCOME_ENGAGEMENT",
      leads: "OUTCOME_LEADS",
      app_promotion: "OUTCOME_APP_PROMOTION",
      sales: "OUTCOME_SALES",
      conversions: "OUTCOME_SALES",
    };

    const body: Record<string, string> = {
      name: campaign.name,
      objective: objectiveMap[campaign.objective] ?? "OUTCOME_AWARENESS",
      status: "PAUSED",
      special_ad_categories: "[]",
      access_token: accessToken,
    };

    if (campaign.dailyBudgetCents) {
      body.daily_budget = String(campaign.dailyBudgetCents);
    }
    if (campaign.lifetimeBudgetCents) {
      body.lifetime_budget = String(campaign.lifetimeBudgetCents);
    }

    const res = await this.adFetch(
      this.adAccountId,
      `${META_GRAPH_API}/act_${this.adAccountId}/campaigns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Meta createCampaign failed: ${err}` };
    }

    const data = await res.json();
    return { success: true, platformCampaignId: data.id, rawResponse: data };
  }

  async updateCampaign(
    accessToken: string,
    campaignId: string,
    updates: CampaignUpdate
  ): Promise<CampaignResult> {
    const body: Record<string, string> = { access_token: accessToken };
    if (updates.name) body.name = updates.name;
    if (updates.dailyBudgetCents)
      body.daily_budget = String(updates.dailyBudgetCents);
    if (updates.lifetimeBudgetCents)
      body.lifetime_budget = String(updates.lifetimeBudgetCents);

    const res = await this.adFetch(this.adAccountId, `${META_GRAPH_API}/${campaignId}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Meta updateCampaign failed: ${await res.text()}`,
      };
    }

    return { success: true, platformCampaignId: campaignId };
  }

  async pauseCampaign(
    accessToken: string,
    campaignId: string
  ): Promise<CampaignResult> {
    const res = await this.adFetch(this.adAccountId, `${META_GRAPH_API}/${campaignId}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        status: "PAUSED",
        access_token: accessToken,
      }),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Meta pauseCampaign failed: ${await res.text()}`,
      };
    }

    return { success: true, platformCampaignId: campaignId };
  }

  async resumeCampaign(
    accessToken: string,
    campaignId: string
  ): Promise<CampaignResult> {
    const res = await this.adFetch(this.adAccountId, `${META_GRAPH_API}/${campaignId}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        status: "ACTIVE",
        access_token: accessToken,
      }),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Meta resumeCampaign failed: ${await res.text()}`,
      };
    }

    return { success: true, platformCampaignId: campaignId };
  }

  // ---- Ad Set ----

  async createAdSet(
    accessToken: string,
    adSet: AdSetInput
  ): Promise<AdSetResult> {
    const targeting: Record<string, unknown> = {};

    if (adSet.targeting.ageMin) targeting.age_min = adSet.targeting.ageMin;
    if (adSet.targeting.ageMax) targeting.age_max = adSet.targeting.ageMax;
    if (adSet.targeting.genders?.length) {
      const genderMap: Record<string, number> = { male: 1, female: 2 };
      targeting.genders = adSet.targeting.genders
        .filter((g) => g !== "all")
        .map((g) => genderMap[g])
        .filter(Boolean);
    }
    if (adSet.targeting.locations?.length) {
      targeting.geo_locations = {
        countries: adSet.targeting.locations
          .filter((l) => l.type === "country")
          .map((l) => l.value),
        regions: adSet.targeting.locations
          .filter((l) => l.type === "region")
          .map((l) => ({ key: l.value })),
        cities: adSet.targeting.locations
          .filter((l) => l.type === "city")
          .map((l) => ({ key: l.value })),
      };
    }
    if (adSet.targeting.interests?.length) {
      targeting.flexible_spec = [
        {
          interests: adSet.targeting.interests.map((i) => ({
            id: i,
            name: i,
          })),
        },
      ];
    }
    if (adSet.targeting.customAudiences?.length) {
      targeting.custom_audiences = adSet.targeting.customAudiences.map(
        (id) => ({ id })
      );
    }
    if (adSet.targeting.excludedAudiences?.length) {
      targeting.excluded_custom_audiences =
        adSet.targeting.excludedAudiences.map((id) => ({ id }));
    }

    const bidStrategyMap: Record<string, string> = {
      lowest_cost: "LOWEST_COST_WITHOUT_CAP",
      cost_cap: "COST_CAP",
      bid_cap: "LOWEST_COST_WITH_BID_CAP",
      target_cost: "COST_CAP",
    };

    const body: Record<string, string> = {
      name: adSet.name,
      campaign_id: adSet.campaignId,
      targeting: JSON.stringify(targeting),
      billing_event: "IMPRESSIONS",
      optimization_goal: "REACH",
      status: "PAUSED",
      access_token: accessToken,
    };

    if (adSet.dailyBudgetCents) {
      body.daily_budget = String(adSet.dailyBudgetCents);
    }
    if (adSet.bidAmountCents) {
      body.bid_amount = String(adSet.bidAmountCents);
    }
    if (adSet.bidStrategy) {
      body.bid_strategy = bidStrategyMap[adSet.bidStrategy] ?? "LOWEST_COST_WITHOUT_CAP";
    }
    if (adSet.startDate) {
      body.start_time = adSet.startDate.toISOString();
    }
    if (adSet.endDate) {
      body.end_time = adSet.endDate.toISOString();
    }

    const res = await fetch(
      `${META_GRAPH_API}/act_${this.adAccountId}/adsets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body),
      }
    );

    if (!res.ok) {
      return {
        success: false,
        error: `Meta createAdSet failed: ${await res.text()}`,
      };
    }

    const data = await res.json();
    return { success: true, platformAdSetId: data.id, rawResponse: data };
  }

  // ---- Ad Creative ----

  async createAd(accessToken: string, ad: AdInput): Promise<AdResult> {
    // First create the ad creative
    const creativeSpec: Record<string, unknown> = {
      name: ad.creative.name,
    };

    if (
      ad.creative.format === "single_image" &&
      ad.creative.mediaUrls?.length
    ) {
      creativeSpec.object_story_spec = {
        page_id: ad.creative.metadata?.pageId,
        link_data: {
          image_url: ad.creative.mediaUrls[0],
          link: ad.creative.destinationUrl,
          message: ad.creative.body,
          name: ad.creative.headline,
          call_to_action: ad.creative.callToAction
            ? { type: ad.creative.callToAction.toUpperCase().replace(/ /g, "_") }
            : undefined,
        },
      };
    } else if (
      ad.creative.format === "single_video" &&
      ad.creative.mediaUrls?.length
    ) {
      creativeSpec.object_story_spec = {
        page_id: ad.creative.metadata?.pageId,
        video_data: {
          video_id: ad.creative.mediaUrls[0],
          title: ad.creative.headline,
          message: ad.creative.body,
          call_to_action: ad.creative.callToAction
            ? {
                type: ad.creative.callToAction.toUpperCase().replace(/ /g, "_"),
                value: { link: ad.creative.destinationUrl },
              }
            : undefined,
          image_url: ad.creative.thumbnailUrl,
        },
      };
    } else if (
      ad.creative.format === "carousel" &&
      ad.creative.mediaUrls?.length
    ) {
      creativeSpec.object_story_spec = {
        page_id: ad.creative.metadata?.pageId,
        link_data: {
          child_attachments: ad.creative.mediaUrls.map((url) => ({
            image_url: url,
            link: ad.creative.destinationUrl,
            name: ad.creative.headline,
          })),
          link: ad.creative.destinationUrl,
          message: ad.creative.body,
        },
      };
    }

    const creativeRes = await this.adFetch(
      this.adAccountId,
      `${META_GRAPH_API}/act_${this.adAccountId}/adcreatives`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          ...Object.fromEntries(
            Object.entries(creativeSpec).map(([k, v]) => [
              k,
              typeof v === "string" ? v : JSON.stringify(v),
            ])
          ),
          access_token: accessToken,
        }),
      }
    );

    if (!creativeRes.ok) {
      return {
        success: false,
        error: `Meta createAdCreative failed: ${await creativeRes.text()}`,
      };
    }

    const creativeData = await creativeRes.json();

    // Now create the ad using the creative
    const adRes = await this.adFetch(
      this.adAccountId,
      `${META_GRAPH_API}/act_${this.adAccountId}/ads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          name: ad.name,
          adset_id: ad.adSetId,
          creative: JSON.stringify({ creative_id: creativeData.id }),
          status: "PAUSED",
          access_token: accessToken,
        }),
      }
    );

    if (!adRes.ok) {
      return {
        success: false,
        error: `Meta createAd failed: ${await adRes.text()}`,
      };
    }

    const adData = await adRes.json();
    return { success: true, platformAdId: adData.id, rawResponse: adData };
  }

  // ---- Metrics ----

  async fetchCampaignMetrics(
    accessToken: string,
    campaignId: string,
    dateRange: DateRange
  ): Promise<AdPerformanceMetric[]> {
    return this.fetchInsights(
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
    return this.fetchInsights(accessToken, adId, "ad", dateRange);
  }

  private async fetchInsights(
    accessToken: string,
    entityId: string,
    entityType: "campaign" | "ad_set" | "ad",
    dateRange: DateRange
  ): Promise<AdPerformanceMetric[]> {
    const params = new URLSearchParams({
      fields:
        "impressions,reach,clicks,spend,actions,cost_per_action_type,ctr,date_start",
      time_range: JSON.stringify({
        since: dateRange.start.toISOString().split("T")[0],
        until: dateRange.end.toISOString().split("T")[0],
      }),
      time_increment: "1",
      access_token: accessToken,
    });

    const res = await this.adFetch(
      this.adAccountId,
      `${META_GRAPH_API}/${entityId}/insights?${params}`
    );
    if (!res.ok) {
      throw new Error(`Meta fetchInsights failed: ${await res.text()}`);
    }

    const data = await res.json();
    const now = new Date();

    return (data.data ?? []).map(
      (row: Record<string, unknown>): AdPerformanceMetric => {
        const impressions = Number(row.impressions ?? 0);
        const clicks = Number(row.clicks ?? 0);
        const spend = Number(row.spend ?? 0);

        const actions = (row.actions as { action_type: string; value: string }[]) ?? [];
        const conversions = actions
          .filter((a) =>
            [
              "offsite_conversion",
              "purchase",
              "lead",
              "complete_registration",
            ].includes(a.action_type)
          )
          .reduce((sum, a) => sum + Number(a.value), 0);

        return {
          platform: "meta",
          entityType,
          entityId,
          date: new Date(row.date_start as string),
          impressions,
          reach: Number(row.reach ?? 0),
          clicks,
          spend,
          conversions,
          costPerClick: clicks > 0 ? spend / clicks : 0,
          costPerConversion: conversions > 0 ? spend / conversions : 0,
          clickThroughRate: impressions > 0 ? (clicks / impressions) * 100 : 0,
          conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
          returnOnAdSpend: 0, // Requires revenue data from conversion tracking
          platformSpecific: {
            actions: row.actions,
            costPerActionType: row.cost_per_action_type,
          },
          fetchedAt: now,
        };
      }
    );
  }
}
