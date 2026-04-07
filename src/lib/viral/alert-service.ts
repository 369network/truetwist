import { prisma } from "@/lib/prisma";
import type { TrendAlertType, TrendDigest } from "./types";

/**
 * Alert System for Viral Trend Notifications
 * - Viral content alerts: notify when relevant trends emerge in user's niche
 * - Configurable alert thresholds per user
 * - In-app notifications + webhook delivery
 * - Daily/weekly trend digest generation
 */

/**
 * Evaluates all active trends against user alert preferences and creates alerts.
 * Called after each trend collection cycle.
 */
export async function evaluateAndCreateAlerts(): Promise<number> {
  const prefs = await prisma.trendAlertPreference.findMany({
    where: { isActive: true },
  });

  if (prefs.length === 0) return 0;

  // Fetch all recent trends once (shared across all prefs) using the lowest minViralScore
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const minScore = Math.min(...prefs.map((p) => p.minViralScore));

  const allRecentTrends = await prisma.viralTrend.findMany({
    where: {
      viralScore: { gte: minScore },
      lastUpdatedAt: { gte: fourHoursAgo },
    },
    orderBy: { viralScore: "desc" },
  });

  // Fetch all existing alerts for the relevant users in one query
  const userIds = Array.from(
    new Set(prefs.map((p: any) => p.userId as string)),
  );
  const trendIds = allRecentTrends.map((t) => t.id);

  const existingAlerts =
    trendIds.length > 0 && userIds.length > 0
      ? await prisma.trendAlert.findMany({
          where: {
            userId: { in: userIds },
            trendId: { in: trendIds },
            createdAt: { gte: oneDayAgo },
          },
          select: { userId: true, trendId: true },
        })
      : [];

  const existingAlertSet = new Set(
    existingAlerts.map((a) => `${a.userId}:${a.trendId}`),
  );

  let alertsCreated = 0;
  const alertsToCreate: Array<{
    userId: string;
    trendId: string;
    alertType: string;
    title: string;
    description: string;
    severity: string;
    metadata: any;
  }> = [];
  const webhooksToSend: Array<{ url: string; payload: unknown }> = [];

  for (const pref of prefs) {
    const nicheKeywords = (pref.nicheKeywords as string[]) || [];
    const platforms = (pref.platforms as string[]) || [];
    const alertTypes = (pref.alertTypes as string[]) || [];

    // Filter trends for this pref from the pre-fetched set
    const matchingTrends = allRecentTrends
      .filter((t) => t.viralScore >= pref.minViralScore)
      .filter((t) => platforms.length === 0 || platforms.includes(t.platform))
      .slice(0, 50);

    for (const trend of matchingTrends) {
      if (existingAlertSet.has(`${pref.userId}:${trend.id}`)) continue;

      const alertType = determineAlertType(trend, nicheKeywords, alertTypes);
      if (!alertType) continue;

      alertsToCreate.push({
        userId: pref.userId,
        trendId: trend.id,
        alertType,
        title: buildAlertTitle(alertType, trend.title),
        description: buildAlertDescription(alertType, trend),
        severity:
          trend.viralScore > 80
            ? "critical"
            : trend.viralScore > 50
              ? "warning"
              : "info",
        metadata: {
          viralScore: trend.viralScore,
          platform: trend.platform,
          lifecycle: trend.lifecycle,
          velocity: trend.velocity,
        },
      });

      // Mark as existing to prevent duplicates within this batch
      existingAlertSet.add(`${pref.userId}:${trend.id}`);

      if (pref.webhookUrl && pref.digestFrequency === "realtime") {
        webhooksToSend.push({
          url: pref.webhookUrl,
          payload: {
            type: alertType,
            trend: {
              title: trend.title,
              platform: trend.platform,
              viralScore: trend.viralScore,
            },
          },
        });
      }
    }
  }

  // Batch insert all alerts
  if (alertsToCreate.length > 0) {
    const result = await prisma.trendAlert.createMany({ data: alertsToCreate });
    alertsCreated = result.count;
  }

  // Fire webhooks concurrently (non-blocking)
  if (webhooksToSend.length > 0) {
    await Promise.allSettled(
      webhooksToSend.map((w) => sendWebhook(w.url, w.payload)),
    );
  }

  return alertsCreated;
}

/**
 * Gets alerts for a user with pagination and filtering.
 */
export async function getUserAlerts(
  userId: string,
  options: {
    alertType?: TrendAlertType;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {},
) {
  const { alertType, unreadOnly = false, limit = 50, offset = 0 } = options;

  const where: Record<string, unknown> = { userId };
  if (alertType) where.alertType = alertType;
  if (unreadOnly) where.readAt = null;

  const [alerts, total] = await Promise.all([
    prisma.trendAlert.findMany({
      where,
      include: {
        trend: {
          select: {
            id: true,
            title: true,
            platform: true,
            viralScore: true,
            lifecycle: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.trendAlert.count({ where }),
  ]);

  return { alerts, total };
}

/**
 * Marks alerts as read.
 */
export async function markAlertsRead(alertIds: string[]): Promise<number> {
  const result = await prisma.trendAlert.updateMany({
    where: { id: { in: alertIds }, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/**
 * Generates a trend digest for a user (daily or weekly).
 */
export async function generateTrendDigest(
  userId: string,
  period: "daily" | "weekly",
): Promise<TrendDigest> {
  const hoursBack = period === "daily" ? 24 : 168;
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const pref = await prisma.trendAlertPreference.findFirst({
    where: { userId, isActive: true },
  });

  const nicheKeywords = (pref?.nicheKeywords as string[]) || [];
  const platforms = (pref?.platforms as string[]) || [];

  // Top trends for the period
  const topTrends = await prisma.viralTrend.findMany({
    where: {
      lastUpdatedAt: { gte: since },
      ...(platforms.length > 0 ? { platform: { in: platforms } } : {}),
    },
    orderBy: { viralScore: "desc" },
    take: 10,
  });

  // Niche matches
  const nicheMatches =
    nicheKeywords.length > 0
      ? await findNicheMatches(nicheKeywords, platforms, since)
      : [];

  // Trending hashtags
  const trendingHashtags = await prisma.hashtag.findMany({
    where: {
      trendDirection: "rising",
      lastUpdatedAt: { gte: since },
      ...(platforms.length > 0 ? { platform: { in: platforms } } : {}),
    },
    orderBy: { reach: "desc" },
    take: 10,
  });

  return {
    userId,
    period,
    topTrends: topTrends.map((t) => ({
      title: t.title,
      platform: t.platform,
      viralScore: t.viralScore,
      lifecycle: t.lifecycle as
        | "emerging"
        | "rising"
        | "peaking"
        | "declining"
        | "expired",
    })),
    nicheMatches: nicheMatches.map((m) => ({
      title: m.title,
      matchedKeyword: m.keyword,
      viralScore: m.viralScore,
    })),
    hashtagInsights: trendingHashtags.map((h) => ({
      tag: h.tag,
      direction: h.trendDirection as "rising" | "stable" | "declining",
      reach: h.reach,
    })),
    generatedAt: new Date(),
  };
}

/**
 * Saves or updates alert preferences for a user.
 */
export async function upsertAlertPreferences(
  userId: string,
  businessId: string | null,
  data: {
    nicheKeywords?: string[];
    platforms?: string[];
    minViralScore?: number;
    alertTypes?: string[];
    digestFrequency?: string;
    webhookUrl?: string | null;
    isActive?: boolean;
  },
) {
  // Handle null businessId case - Prisma doesn't allow null in unique constraints
  if (businessId === null) {
    // Check if a global preference already exists for this user
    const existing = await prisma.trendAlertPreference.findFirst({
      where: { userId, businessId: null },
    });

    if (existing) {
      // Update existing global preference
      return prisma.trendAlertPreference.update({
        where: { id: existing.id },
        data,
      });
    } else {
      // Create new global preference
      return prisma.trendAlertPreference.create({
        data: {
          userId,
          businessId: null,
          ...data,
        },
      });
    }
  }

  return prisma.trendAlertPreference.upsert({
    where: {
      userId_businessId: { userId, businessId },
    },
    update: data,
    create: {
      userId,
      businessId,
      ...data,
    },
  });
}

function determineAlertType(
  trend: {
    title: string;
    lifecycle: string;
    viralScore: number;
    category: string | null;
  },
  nicheKeywords: string[],
  enabledTypes: string[],
): TrendAlertType | null {
  const titleLower = trend.title.toLowerCase();

  // Check niche match
  if (enabledTypes.includes("niche_match")) {
    const matched = nicheKeywords.some((kw) =>
      titleLower.includes(kw.toLowerCase()),
    );
    if (matched) return "niche_match";
  }

  // Check trend lifecycle alerts
  if (
    enabledTypes.includes("trend_emerging") &&
    trend.lifecycle === "emerging" &&
    trend.viralScore > 30
  ) {
    return "trend_emerging";
  }

  if (enabledTypes.includes("trend_peaking") && trend.lifecycle === "peaking") {
    return "trend_peaking";
  }

  return null;
}

function buildAlertTitle(type: TrendAlertType, trendTitle: string): string {
  switch (type) {
    case "trend_emerging":
      return `Emerging trend: ${trendTitle}`;
    case "trend_peaking":
      return `Trend peaking now: ${trendTitle}`;
    case "niche_match":
      return `Trend in your niche: ${trendTitle}`;
    case "hashtag_trending":
      return `Hashtag trending: #${trendTitle}`;
  }
}

function buildAlertDescription(
  type: TrendAlertType,
  trend: {
    title: string;
    platform: string;
    viralScore: number;
    lifecycle: string;
  },
): string {
  return `"${trend.title}" is ${trend.lifecycle} on ${trend.platform} with a viral score of ${Math.round(trend.viralScore)}/100. Consider creating content around this topic.`;
}

async function findNicheMatches(
  keywords: string[],
  platforms: string[],
  since: Date,
): Promise<Array<{ title: string; keyword: string; viralScore: number }>> {
  if (keywords.length === 0) return [];

  // Fetch all matching trends in one query using OR conditions instead of per-keyword loop
  const trends = await prisma.viralTrend.findMany({
    where: {
      OR: keywords.map((kw) => ({
        title: { contains: kw, mode: "insensitive" as const },
      })),
      lastUpdatedAt: { gte: since },
      ...(platforms.length > 0 ? { platform: { in: platforms } } : {}),
    },
    orderBy: { viralScore: "desc" },
    select: { title: true, viralScore: true },
    take: 30, // fetch enough to cover all keywords
  });

  // Match each trend back to keywords
  const results: Array<{ title: string; keyword: string; viralScore: number }> =
    [];
  for (const t of trends) {
    const titleLower = t.title.toLowerCase();
    const matchedKeyword = keywords.find((kw) =>
      titleLower.includes(kw.toLowerCase()),
    );
    if (matchedKeyword) {
      results.push({
        title: t.title,
        keyword: matchedKeyword,
        viralScore: t.viralScore,
      });
    }
  }

  return results.sort((a, b) => b.viralScore - a.viralScore).slice(0, 10);
}

async function sendWebhook(url: string, payload: unknown): Promise<void> {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
}
