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

const GOOGLE_ADS_API = "https://googleads.googleapis.com/v17";

/**
 * Google Ads API v17 adapter (REST, no client library for Vercel edge compat).
 *
 * Supports responsive search ads, display ads, video ads.
 * Reporting via Google Ads Query Language (GAQL).
 * Requires developer token + OAuth.
 */
export class GoogleAdsAdapter extends AdPlatformAdapter {
  readonly platform: AdPlatform = "google";
  readonly rateLimitConfig: AdRateLimitConfig = AD_PLATFORM_RATE_LIMITS.google;

  private customerId: string;

  constructor(customerId: string) {
    super();
    // Google Ads customer IDs are stored without dashes
    this.customerId = customerId.replace(/-/g, "");
  }

  private getHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      "Content-Type": "application/json",
    };
  }

  // ---- OAuth ----

  getAdOAuthConfig(): AdOAuthConfig {
    return {
      platform: "google",
      clientId: process.env.GOOGLE_ADS_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: ["https://www.googleapis.com/auth/adwords"],
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/auth/callback/google-ads`,
    };
  }

  async exchangeAdCodeForTokens(code: string): Promise<AdOAuthTokens> {
    const config = this.getAdOAuthConfig();

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) {
      throw new Error(`Google token exchange failed: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: (data.scope ?? "").split(" ").filter(Boolean),
      tokenType: data.token_type ?? "Bearer",
    };
  }

  async refreshAdAccessToken(
    refreshToken: string
  ): Promise<AdOAuthTokens | null> {
    const config = this.getAdOAuthConfig();

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: (data.scope ?? "").split(" ").filter(Boolean),
      tokenType: data.token_type ?? "Bearer",
    };
  }

  // ---- Account ----

  async getAdAccountInfo(accessToken: string): Promise<AdAccountInfo> {
    const query = `
      SELECT customer.id, customer.descriptive_name, customer.currency_code,
             customer.time_zone, customer.status
      FROM customer
      LIMIT 1
    `;

    const res = await fetch(
      `${GOOGLE_ADS_API}/customers/${this.customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({ query }),
      }
    );

    if (!res.ok) {
      throw new Error(`Google getAdAccountInfo failed: ${await res.text()}`);
    }

    const data = await res.json();
    const customer = data[0]?.results?.[0]?.customer;
    if (!customer) {
      throw new Error("No customer data returned from Google Ads");
    }

    const statusMap: Record<string, AdAccountInfo["status"]> = {
      ENABLED: "active",
      CANCELED: "disabled",
      SUSPENDED: "disabled",
    };

    return {
      platformAccountId: customer.id,
      platform: "google",
      name: customer.descriptiveName ?? "",
      currency: customer.currencyCode ?? "USD",
      timezone: customer.timeZone ?? "UTC",
      status: statusMap[customer.status] ?? "disabled",
    };
  }

  // ---- Campaign CRUD ----

  async createCampaign(
    accessToken: string,
    campaign: CampaignInput
  ): Promise<CampaignResult> {
    const objectiveMap: Record<string, string> = {
      awareness: "BRAND_AWARENESS",
      traffic: "WEBSITE_TRAFFIC",
      engagement: "BRAND_AWARENESS",
      leads: "LEAD_GENERATION",
      app_promotion: "APP_PROMOTION",
      sales: "PERFORMANCE_MAX",
      conversions: "PERFORMANCE_MAX",
    };

    const operations = [
      {
        create: {
          name: campaign.name,
          advertisingChannelType: "SEARCH",
          status: "PAUSED",
          campaignBudget: `customers/${this.customerId}/campaignBudgets/-1`,
          startDate: campaign.startDate.toISOString().split("T")[0].replace(/-/g, ""),
          ...(campaign.endDate && {
            endDate: campaign.endDate.toISOString().split("T")[0].replace(/-/g, ""),
          }),
        },
      },
    ];

    // Create campaign budget first
    const budgetRes = await fetch(
      `${GOOGLE_ADS_API}/customers/${this.customerId}/campaignBudgets:mutate`,
      {
        method: "POST",
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({
          operations: [
            {
              create: {
                name: `${campaign.name} Budget`,
                amountMicros: String(campaign.dailyBudgetCents * 10000),
                deliveryMethod: "STANDARD",
                explicitlyShared: false,
              },
            },
          ],
        }),
      }
    );

    if (!budgetRes.ok) {
      return {
        success: false,
        error: `Google createBudget failed: ${await budgetRes.text()}`,
      };
    }

    const budgetData = await budgetRes.json();
    const budgetResourceName = budgetData.results?.[0]?.resourceName;

    // Now create campaign with budget reference
    operations[0].create.campaignBudget = budgetResourceName;

    const res = await fetch(
      `${GOOGLE_ADS_API}/customers/${this.customerId}/campaigns:mutate`,
      {
        method: "POST",
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({ operations }),
      }
    );

    if (!res.ok) {
      return {
        success: false,
        error: `Google createCampaign failed: ${await res.text()}`,
      };
    }

    const data = await res.json();
    const resourceName = data.results?.[0]?.resourceName ?? "";
    const campaignId = resourceName.split("/").pop() ?? "";

    return {
      success: true,
      platformCampaignId: campaignId,
      rawResponse: data,
    };
  }

  async updateCampaign(
    accessToken: string,
    campaignId: string,
    updates: CampaignUpdate
  ): Promise<CampaignResult> {
    const updateFields: Record<string, unknown> = {
      resourceName: `customers/${this.customerId}/campaigns/${campaignId}`,
    };
    const updateMask: string[] = [];

    if (updates.name) {
      updateFields.name = updates.name;
      updateMask.push("name");
    }
    if (updates.endDate) {
      updateFields.endDate = updates.endDate
        .toISOString()
        .split("T")[0]
        .replace(/-/g, "");
      updateMask.push("end_date");
    }

    const res = await fetch(
      `${GOOGLE_ADS_API}/customers/${this.customerId}/campaigns:mutate`,
      {
        method: "POST",
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({
          operations: [{ update: updateFields, updateMask: updateMask.join(",") }],
        }),
      }
    );

    if (!res.ok) {
      return {
        success: false,
        error: `Google updateCampaign failed: ${await res.text()}`,
      };
    }

    return { success: true, platformCampaignId: campaignId };
  }

  async pauseCampaign(
    accessToken: string,
    campaignId: string
  ): Promise<CampaignResult> {
    const res = await fetch(
      `${GOOGLE_ADS_API}/customers/${this.customerId}/campaigns:mutate`,
      {
        method: "POST",
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({
          operations: [
            {
              update: {
                resourceName: `customers/${this.customerId}/campaigns/${campaignId}`,
                status: "PAUSED",
              },
              updateMask: "status",
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      return {
        success: false,
        error: `Google pauseCampaign failed: ${await res.text()}`,
      };
    }

    return { success: true, platformCampaignId: campaignId };
  }

  async resumeCampaign(
    accessToken: string,
    campaignId: string
  ): Promise<CampaignResult> {
    const res = await fetch(
      `${GOOGLE_ADS_API}/customers/${this.customerId}/campaigns:mutate`,
      {
        method: "POST",
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({
          operations: [
            {
              update: {
                resourceName: `customers/${this.customerId}/campaigns/${campaignId}`,
                status: "ENABLED",
              },
              updateMask: "status",
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      return {
        success: false,
        error: `Google resumeCampaign failed: ${await res.text()}`,
      };
    }

    return { success: true, platformCampaignId: campaignId };
  }

  // ---- Ad Set (Ad Group in Google) ----

  async createAdSet(
    accessToken: string,
    adSet: AdSetInput
  ): Promise<AdSetResult> {
    const campaignResourceName = `customers/${this.customerId}/campaigns/${adSet.campaignId}`;

    const adGroup: Record<string, unknown> = {
      name: adSet.name,
      campaign: campaignResourceName,
      status: "PAUSED",
      type: "SEARCH_STANDARD",
    };

    if (adSet.bidAmountCents) {
      adGroup.cpcBidMicros = String(adSet.bidAmountCents * 10000);
    }

    const res = await fetch(
      `${GOOGLE_ADS_API}/customers/${this.customerId}/adGroups:mutate`,
      {
        method: "POST",
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({
          operations: [{ create: adGroup }],
        }),
      }
    );

    if (!res.ok) {
      return {
        success: false,
        error: `Google createAdGroup failed: ${await res.text()}`,
      };
    }

    const data = await res.json();
    const resourceName = data.results?.[0]?.resourceName ?? "";
    const adGroupId = resourceName.split("/").pop() ?? "";

    return {
      success: true,
      platformAdSetId: adGroupId,
      rawResponse: data,
    };
  }

  // ---- Ad Creative ----

  async createAd(accessToken: string, ad: AdInput): Promise<AdResult> {
    const adGroupResourceName = `customers/${this.customerId}/adGroups/${ad.adSetId}`;

    const adOperation: Record<string, unknown> = {
      adGroup: adGroupResourceName,
      status: "PAUSED",
      ad: {} as Record<string, unknown>,
    };

    if (
      ad.creative.format === "responsive_search" ||
      ad.creative.format === "single_image"
    ) {
      (adOperation.ad as Record<string, unknown>).responsiveSearchAd = {
        headlines: [
          { text: ad.creative.headline ?? ad.creative.name },
          { text: ad.creative.name },
          { text: ad.creative.callToAction ?? "Learn More" },
        ],
        descriptions: [
          { text: ad.creative.body ?? "" },
          { text: ad.creative.callToAction ?? "Visit us today" },
        ],
        path1: "",
        path2: "",
      };
      (adOperation.ad as Record<string, unknown>).finalUrls = [
        ad.creative.destinationUrl ?? "",
      ];
    } else if (ad.creative.format === "responsive_display") {
      (adOperation.ad as Record<string, unknown>).responsiveDisplayAd = {
        headlines: [{ text: ad.creative.headline ?? ad.creative.name }],
        longHeadline: { text: ad.creative.headline ?? ad.creative.name },
        descriptions: [{ text: ad.creative.body ?? "" }],
        marketingImages:
          ad.creative.mediaUrls?.map((url) => ({ asset: url })) ?? [],
      };
      (adOperation.ad as Record<string, unknown>).finalUrls = [
        ad.creative.destinationUrl ?? "",
      ];
    }

    const res = await fetch(
      `${GOOGLE_ADS_API}/customers/${this.customerId}/adGroupAds:mutate`,
      {
        method: "POST",
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({
          operations: [{ create: adOperation }],
        }),
      }
    );

    if (!res.ok) {
      return {
        success: false,
        error: `Google createAd failed: ${await res.text()}`,
      };
    }

    const data = await res.json();
    const resourceName = data.results?.[0]?.resourceName ?? "";
    const adId = resourceName.split("/").pop() ?? "";

    return { success: true, platformAdId: adId, rawResponse: data };
  }

  // ---- Metrics (GAQL) ----

  async fetchCampaignMetrics(
    accessToken: string,
    campaignId: string,
    dateRange: DateRange
  ): Promise<AdPerformanceMetric[]> {
    return this.runGaqlReport(
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
    return this.runGaqlReport(accessToken, adId, "ad", dateRange);
  }

  private async runGaqlReport(
    accessToken: string,
    entityId: string,
    entityType: "campaign" | "ad",
    dateRange: DateRange
  ): Promise<AdPerformanceMetric[]> {
    const startDate = dateRange.start.toISOString().split("T")[0];
    const endDate = dateRange.end.toISOString().split("T")[0];

    const entityFilter =
      entityType === "campaign"
        ? `campaign.id = ${entityId}`
        : `ad_group_ad.ad.id = ${entityId}`;

    const query = `
      SELECT
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.cost_per_conversion,
        metrics.ctr,
        metrics.conversions_from_interactions_rate
      FROM ${entityType === "campaign" ? "campaign" : "ad_group_ad"}
      WHERE ${entityFilter}
        AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY segments.date ASC
    `;

    const res = await fetch(
      `${GOOGLE_ADS_API}/customers/${this.customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({ query }),
      }
    );

    if (!res.ok) {
      throw new Error(`Google GAQL report failed: ${await res.text()}`);
    }

    const data = await res.json();
    const now = new Date();

    const results: AdPerformanceMetric[] = [];
    for (const batch of data) {
      for (const row of batch.results ?? []) {
        const m = row.metrics;
        const impressions = Number(m.impressions ?? 0);
        const clicks = Number(m.clicks ?? 0);
        const spendMicros = Number(m.costMicros ?? 0);
        const spend = spendMicros / 1_000_000;
        const conversions = Number(m.conversions ?? 0);

        results.push({
          platform: "google",
          entityType: entityType === "campaign" ? "campaign" : "ad",
          entityId,
          date: new Date(row.segments.date),
          impressions,
          reach: impressions, // Google Ads doesn't distinguish reach from impressions in search
          clicks,
          spend,
          conversions,
          costPerClick: clicks > 0 ? spend / clicks : 0,
          costPerConversion:
            conversions > 0 ? spend / conversions : 0,
          clickThroughRate: Number(m.ctr ?? 0) * 100,
          conversionRate:
            Number(m.conversionsFromInteractionsRate ?? 0) * 100,
          returnOnAdSpend: 0,
          platformSpecific: { costMicros: spendMicros },
          fetchedAt: now,
        });
      }
    }

    return results;
  }
}
