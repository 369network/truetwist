/**
 * Test utilities for mocking ad platform APIs (Meta Ads, Google Ads, TikTok Ads, LinkedIn Ads).
 * Provides mock responses for common API endpoints used in ad account sync and metrics collection.
 */

import { vi } from "vitest";

// ── Meta Ads API Mocks ──

export interface MetaAdAccount {
  id: string;
  name: string;
  account_id: string;
  account_status: number; // 1 = ACTIVE, 2 = DISABLED, 3 = UNSETTLED, etc.
  currency: string;
  timezone_name: string;
  timezone_offset_hours_utc: number;
  capabilities: string[];
}

export interface MetaAdCampaign {
  id: string;
  name: string;
  objective: string;
  status: string; // ACTIVE, PAUSED, DELETED, etc.
  daily_budget?: number;
  lifetime_budget?: number;
  start_time?: string;
  stop_time?: string;
}

export interface MetaAdMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value?: number;
  ctr: number;
  cpc: number;
  reach?: number;
  frequency?: number;
  video_views?: number;
  video_view_rate?: number;
  date_start: string;
  date_stop: string;
}

export function createMetaAdsMocks() {
  const mockAdAccounts: MetaAdAccount[] = [
    {
      id: "act_123456789",
      name: "Test Business Ad Account",
      account_id: "123456789",
      account_status: 1, // ACTIVE
      currency: "USD",
      timezone_name: "America/New_York",
      timezone_offset_hours_utc: -5,
      capabilities: ["ADS_MANAGEMENT", "ADS_READ", "BILLING_READ"],
    },
    {
      id: "act_987654321",
      name: "Secondary Ad Account",
      account_id: "987654321",
      account_status: 2, // DISABLED
      currency: "EUR",
      timezone_name: "Europe/London",
      timezone_offset_hours_utc: 0,
      capabilities: ["ADS_MANAGEMENT"],
    },
  ];

  const mockCampaigns: Record<string, MetaAdCampaign[]> = {
    act_123456789: [
      {
        id: "campaign_123456",
        name: "Q1 Brand Awareness",
        objective: "BRAND_AWARENESS",
        status: "ACTIVE",
        daily_budget: 10000,
        start_time: "2026-01-01T00:00:00-0500",
      },
      {
        id: "campaign_789012",
        name: "Product Launch Conversions",
        objective: "CONVERSIONS",
        status: "ACTIVE",
        daily_budget: 25000,
        start_time: "2026-01-15T00:00:00-0500",
      },
    ],
  };

  const mockMetrics: Record<string, MetaAdMetrics[]> = {
    campaign_123456: [
      {
        impressions: 50000,
        clicks: 1500,
        spend: 7500,
        conversions: 120,
        conversion_value: 36000,
        ctr: 3.0,
        cpc: 5.0,
        reach: 45000,
        frequency: 1.11,
        video_views: 12000,
        video_view_rate: 24.0,
        date_start: "2026-03-01",
        date_stop: "2026-03-31",
      },
    ],
    campaign_789012: [
      {
        impressions: 75000,
        clicks: 3000,
        spend: 22500,
        conversions: 450,
        conversion_value: 135000,
        ctr: 4.0,
        cpc: 7.5,
        reach: 60000,
        frequency: 1.25,
        video_views: 18000,
        video_view_rate: 24.0,
        date_start: "2026-03-01",
        date_stop: "2026-03-31",
      },
    ],
  };

  return {
    adAccounts: mockAdAccounts,
    campaigns: mockCampaigns,
    metrics: mockMetrics,
  };
}

export function mockMetaAdsApi() {
  const mocks = createMetaAdsMocks();
  const fetchMock = vi.fn();

  fetchMock.mockImplementation((url: string, options?: RequestInit) => {
    // OAuth token exchange
    if (url.includes("oauth/access_token")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "mock-access-token-123",
            token_type: "bearer",
            expires_in: 3600,
          }),
      });
    }

    // Long-lived token exchange
    if (url.includes("fb_exchange_token")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "mock-long-lived-token-456",
            token_type: "bearer",
            expires_in: 5184000, // 60 days
          }),
      });
    }

    // Ad accounts list
    if (url.includes("/me/adaccounts")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: mocks.adAccounts.filter((acc) => acc.account_status === 1), // Only active accounts
          }),
      });
    }

    // Campaigns list
    if (url.includes("/campaigns")) {
      const accountIdMatch = url.match(/act_\d+/);
      if (accountIdMatch) {
        const accountId = accountIdMatch[0];
        const accountCampaigns = mocks.campaigns[accountId] || [];
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: accountCampaigns,
            }),
        });
      }
    }

    // Campaign insights (metrics)
    if (url.includes("/insights")) {
      const campaignIdMatch = url.match(/campaign_\d+/);
      if (campaignIdMatch) {
        const campaignId = campaignIdMatch[0];
        const campaignMetrics = mocks.metrics[campaignId] || [];
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: campaignMetrics,
            }),
        });
      }
    }

    // User info
    if (url.includes("/me")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "123456789012345",
            name: "Test User",
            email: "test@example.com",
          }),
      });
    }

    // Default fallback
    console.warn(`Unhandled Meta Ads API call: ${url}`);
    return Promise.resolve({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not Found"),
    });
  });

  return fetchMock;
}

// ── Google Ads API Mocks ──

export interface GoogleAdAccount {
  resourceName: string;
  id: string;
  name: string;
  currencyCode: string;
  timeZone: string;
  status: string; // ENABLED, REMOVED, etc.
}

export interface GoogleAdCampaign {
  resourceName: string;
  id: string;
  name: string;
  status: string; // ENABLED, PAUSED, REMOVED
  advertisingChannelType: string; // SEARCH, DISPLAY, VIDEO, etc.
  campaignBudget: {
    amountMicros: number;
  };
  startDate?: string;
  endDate?: string;
}

export interface GoogleAdMetrics {
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  averageCpcMicros: number;
  allConversions: number;
  allConversionValue: number;
  date: string;
}

export function createGoogleAdsMocks() {
  const mockAdAccounts: GoogleAdAccount[] = [
    {
      resourceName: "customers/1234567890",
      id: "1234567890",
      name: "Test Google Ads Account",
      currencyCode: "USD",
      timeZone: "America/New_York",
      status: "ENABLED",
    },
  ];

  const mockCampaigns: Record<string, GoogleAdCampaign[]> = {
    "1234567890": [
      {
        resourceName: "customers/1234567890/campaigns/111222333",
        id: "111222333",
        name: "Search Campaign - Brand",
        status: "ENABLED",
        advertisingChannelType: "SEARCH",
        campaignBudget: {
          amountMicros: 10000000, // $10
        },
        startDate: "2026-01-01",
      },
      {
        resourceName: "customers/1234567890/campaigns/444555666",
        id: "444555666",
        name: "Display Campaign - Retargeting",
        status: "ENABLED",
        advertisingChannelType: "DISPLAY",
        campaignBudget: {
          amountMicros: 20000000, // $20
        },
        startDate: "2026-01-01",
      },
    ],
  };

  const mockMetrics: Record<string, GoogleAdMetrics[]> = {
    "111222333": [
      {
        impressions: 25000,
        clicks: 500,
        costMicros: 2500000, // $2.50
        conversions: 25,
        conversionValue: 7500, // $75.00
        ctr: 2.0,
        averageCpcMicros: 5000, // $0.005
        allConversions: 30,
        allConversionValue: 9000,
        date: "2026-03-01",
      },
    ],
    "444555666": [
      {
        impressions: 100000,
        clicks: 2000,
        costMicros: 5000000, // $5.00
        conversions: 50,
        conversionValue: 15000, // $150.00
        ctr: 2.0,
        averageCpcMicros: 2500, // $0.0025
        allConversions: 60,
        allConversionValue: 18000,
        date: "2026-03-01",
      },
    ],
  };

  return {
    adAccounts: mockAdAccounts,
    campaigns: mockCampaigns,
    metrics: mockMetrics,
  };
}

export function mockGoogleAdsApi() {
  const mocks = createGoogleAdsMocks();
  const fetchMock = vi.fn();

  fetchMock.mockImplementation((url: string, options?: RequestInit) => {
    // OAuth token exchange
    if (url.includes("oauth2/v4/token")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "mock-google-access-token-123",
            token_type: "Bearer",
            expires_in: 3600,
            refresh_token: "mock-google-refresh-token-456",
          }),
      });
    }

    // Customer list (ad accounts)
    if (url.includes("/customers:listAccessibleCustomers")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            resourceNames: mocks.adAccounts.map((acc) => acc.resourceName),
          }),
      });
    }

    // Customer details
    if (url.includes("/customers/")) {
      const accountIdMatch = url.match(/customers\/(\d+)/);
      if (accountIdMatch) {
        const accountId = accountIdMatch[1];
        const account = mocks.adAccounts.find((acc) => acc.id === accountId);
        if (account) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(account),
          });
        }
      }
    }

    // Campaigns search
    if (url.includes("/googleAds:search")) {
      const body = options?.body ? JSON.parse(options.body as string) : {};
      if (body.query?.includes("campaign")) {
        const accountIdMatch = body.query.match(/customers\/(\d+)/);
        if (accountIdMatch) {
          const accountId = accountIdMatch[1];
          const accountCampaigns = mocks.campaigns[accountId] || [];
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                results: accountCampaigns.map((campaign) => ({
                  campaign,
                })),
              }),
          });
        }
      }
    }

    // Metrics search
    if (
      url.includes("/googleAds:search") &&
      options?.body?.toString().includes("metrics")
    ) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            results: Object.entries(mocks.metrics).flatMap(
              ([campaignId, metricsList]) =>
                metricsList.map((metrics) => ({
                  metrics,
                  campaign: {
                    resourceName: `customers/1234567890/campaigns/${campaignId}`,
                  },
                })),
            ),
          }),
      });
    }

    // Default fallback
    console.warn(`Unhandled Google Ads API call: ${url}`);
    return Promise.resolve({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not Found"),
    });
  });

  return fetchMock;
}

// ── TikTok Ads API Mocks ──

export interface TikTokAdAccount {
  advertiser_id: string;
  advertiser_name: string;
  currency: string;
  timezone: string;
  status: string; // ENABLE, DISABLE
}

export interface TikTokAdCampaign {
  campaign_id: string;
  campaign_name: string;
  objective_type: string;
  status: string; // ENABLE, DISABLE
  budget_mode: string;
  budget: number;
  start_time: string;
  end_time?: string;
}

export interface TikTokAdMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  conversion_rate: number;
  date: string;
}

export function createTikTokAdsMocks() {
  const mockAdAccounts: TikTokAdAccount[] = [
    {
      advertiser_id: "123456789012345",
      advertiser_name: "Test TikTok Advertiser",
      currency: "USD",
      timezone: "UTC",
      status: "ENABLE",
    },
  ];

  const mockCampaigns: Record<string, TikTokAdCampaign[]> = {
    "123456789012345": [
      {
        campaign_id: "1234567890",
        campaign_name: "TikTok Brand Campaign",
        objective_type: "CONVERSIONS",
        status: "ENABLE",
        budget_mode: "BUDGET_MODE_DAY",
        budget: 5000,
        start_time: "2026-01-01 00:00:00",
      },
    ],
  };

  const mockMetrics: Record<string, TikTokAdMetrics[]> = {
    "1234567890": [
      {
        impressions: 100000,
        clicks: 5000,
        spend: 2500,
        conversions: 250,
        ctr: 5.0,
        cpc: 0.5,
        conversion_rate: 5.0,
        date: "2026-03-01",
      },
    ],
  };

  return {
    adAccounts: mockAdAccounts,
    campaigns: mockCampaigns,
    metrics: mockMetrics,
  };
}

// ── LinkedIn Ads API Mocks ──

export interface LinkedInAdAccount {
  id: string;
  name: string;
  currency: string;
  status: string; // ACTIVE, DRAFT, ARCHIVED, etc.
  type: string;
}

export interface LinkedInAdCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
  objectiveType: string;
  dailyBudget?: {
    amount: string;
    currencyCode: string;
  };
  startDate?: string;
  endDate?: string;
}

export interface LinkedInAdMetrics {
  impressions: number;
  clicks: number;
  costInLocalCurrency: number;
  oneClickLeads: number;
  opens: number;
  sends: number;
  dateRange: {
    start: string;
    end: string;
  };
}

export function createLinkedInAdsMocks() {
  const mockAdAccounts: LinkedInAdAccount[] = [
    {
      id: "123456789",
      name: "Test LinkedIn Account",
      currency: "USD",
      status: "ACTIVE",
      type: "BUSINESS",
    },
  ];

  const mockCampaigns: Record<string, LinkedInAdCampaign[]> = {
    "123456789": [
      {
        id: "111222333",
        name: "LinkedIn Brand Awareness",
        status: "ACTIVE",
        type: "SPONSORED_UPDATES",
        objectiveType: "BRAND_AWARENESS",
        dailyBudget: {
          amount: "100.00",
          currencyCode: "USD",
        },
        startDate: "2026-01-01",
      },
    ],
  };

  const mockMetrics: Record<string, LinkedInAdMetrics[]> = {
    "111222333": [
      {
        impressions: 50000,
        clicks: 1000,
        costInLocalCurrency: 5000,
        oneClickLeads: 50,
        opens: 500,
        sends: 100,
        dateRange: {
          start: "2026-03-01",
          end: "2026-03-31",
        },
      },
    ],
  };

  return {
    adAccounts: mockAdAccounts,
    campaigns: mockCampaigns,
    metrics: mockMetrics,
  };
}

// ── Utility Functions ──

export function setupAdPlatformMocks() {
  const metaMock = mockMetaAdsApi();
  const googleMock = mockGoogleAdsApi();

  global.fetch = vi.fn((url: string, options?: RequestInit) => {
    // Route to appropriate mock based on URL
    if (url.includes("facebook.com") || url.includes("graph.facebook.com")) {
      return metaMock(url, options);
    }
    if (
      url.includes("googleapis.com") ||
      url.includes("googleads.googleapis.com")
    ) {
      return googleMock(url, options);
    }
    // Default fallback for other API calls
    console.warn(`Unhandled API call: ${url}`);
    return Promise.resolve({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not Found"),
    });
  });

  return {
    metaMock,
    googleMock,
    resetMocks: () => {
      vi.clearAllMocks();
      global.fetch = vi.fn();
    },
  };
}

// ── Test Data Generators ──

export function generateTestAdAccount(overrides = {}) {
  const baseAccount = {
    id: "ad-account-" + Math.random().toString(36).substr(2, 9),
    userId: "user-" + Math.random().toString(36).substr(2, 9),
    businessId: "business-" + Math.random().toString(36).substr(2, 9),
    platform: "meta_ads" as const,
    platformAccountId: "act_" + Math.floor(Math.random() * 1000000000),
    accountName: "Test Ad Account",
    accountCurrency: "USD",
    timezone: "UTC",
    encryptedToken: "mock-encrypted-token",
    tokenIv: "mock-iv",
    tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: "active" as const,
    lastSyncedAt: null,
    syncError: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...baseAccount, ...overrides };
}

export function generateTestAdCampaign(overrides = {}) {
  const baseCampaign = {
    id: "campaign-" + Math.random().toString(36).substr(2, 9),
    adAccountId: "ad-account-" + Math.random().toString(36).substr(2, 9),
    platformCampaignId: "campaign_" + Math.floor(Math.random() * 1000000000),
    name: "Test Campaign",
    status: "active",
    objective: "conversions",
    dailyBudgetCents: 10000,
    lifetimeBudgetCents: 100000,
    startDate: new Date(),
    endDate: null,
    targeting: {},
    creativeIds: [],
    metadata: {},
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...baseCampaign, ...overrides };
}

export function generateTestAdMetrics(overrides = {}) {
  const baseMetrics = {
    id: "metrics-" + Math.random().toString(36).substr(2, 9),
    adAccountId: "ad-account-" + Math.random().toString(36).substr(2, 9),
    adCampaignId: "campaign-" + Math.random().toString(36).substr(2, 9),
    date: new Date(),
    impressions: Math.floor(Math.random() * 100000),
    clicks: Math.floor(Math.random() * 10000),
    spendCents: Math.floor(Math.random() * 100000),
    conversions: Math.floor(Math.random() * 1000),
    conversionValueCents: Math.floor(Math.random() * 1000000),
    ctr: Math.random() * 10,
    cpcCents: Math.random() * 100,
    roas: Math.random() * 5,
    reach: Math.floor(Math.random() * 50000),
    frequency: Math.random() * 3,
    videoViews: Math.floor(Math.random() * 50000),
    videoViewRate: Math.random() * 50,
    createdAt: new Date(),
  };

  return { ...baseMetrics, ...overrides };
}
