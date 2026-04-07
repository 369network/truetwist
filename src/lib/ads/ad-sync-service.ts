import { AdAccountManager } from "./ad-account-manager";
import type {
  AdPlatform,
  AdPerformanceMetric,
  DateRange,
} from "./types";

interface AdAccountCredentials {
  platform: AdPlatform;
  platformAccountId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  expiresAt: Date | null;
}

interface SyncResult {
  platform: AdPlatform;
  entityId: string;
  entityType: "campaign" | "ad";
  metrics: AdPerformanceMetric[];
  error?: string;
}

/**
 * Service for fetching and syncing ad performance metrics across platforms.
 * Handles batch fetching, error recovery, and metric normalization.
 */
export class AdSyncService {
  /**
   * Fetches campaign metrics for a single campaign.
   */
  static async syncCampaignMetrics(
    credentials: AdAccountCredentials,
    campaignId: string,
    dateRange: DateRange
  ): Promise<SyncResult> {
    try {
      const { accessToken } =
        await AdAccountManager.getAccessToken(credentials);
      const adapter = AdAccountManager.getAdapter(
        credentials.platform,
        credentials.platformAccountId
      );

      const metrics = await adapter.fetchCampaignMetrics(
        accessToken,
        campaignId,
        dateRange
      );

      return {
        platform: credentials.platform,
        entityId: campaignId,
        entityType: "campaign",
        metrics,
      };
    } catch (err) {
      return {
        platform: credentials.platform,
        entityId: campaignId,
        entityType: "campaign",
        metrics: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Fetches ad-level metrics for a single ad.
   */
  static async syncAdMetrics(
    credentials: AdAccountCredentials,
    adId: string,
    dateRange: DateRange
  ): Promise<SyncResult> {
    try {
      const { accessToken } =
        await AdAccountManager.getAccessToken(credentials);
      const adapter = AdAccountManager.getAdapter(
        credentials.platform,
        credentials.platformAccountId
      );

      const metrics = await adapter.fetchAdMetrics(
        accessToken,
        adId,
        dateRange
      );

      return {
        platform: credentials.platform,
        entityId: adId,
        entityType: "ad",
        metrics,
      };
    } catch (err) {
      return {
        platform: credentials.platform,
        entityId: adId,
        entityType: "ad",
        metrics: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Batch-fetches metrics for multiple campaigns across platforms.
   * Runs all requests concurrently with error isolation per campaign.
   */
  static async syncMultipleCampaigns(
    items: {
      credentials: AdAccountCredentials;
      campaignId: string;
    }[],
    dateRange: DateRange
  ): Promise<SyncResult[]> {
    return Promise.all(
      items.map((item) =>
        AdSyncService.syncCampaignMetrics(
          item.credentials,
          item.campaignId,
          dateRange
        )
      )
    );
  }

  /**
   * Returns yesterday's date range (common for daily sync).
   */
  static getYesterdayRange(): DateRange {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);
    return { start, end };
  }

  /**
   * Returns last 7 days date range.
   */
  static getLast7DaysRange(): DateRange {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return { start, end };
  }

  /**
   * Returns last 30 days date range.
   */
  static getLast30DaysRange(): DateRange {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    return { start, end };
  }
}
