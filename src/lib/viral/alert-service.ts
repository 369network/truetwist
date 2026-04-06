import { prisma } from '@/lib/prisma';
import type { TrendAlertType, TrendDigest } from './types';

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

  let alertsCreated = 0;

  for (const pref of prefs) {
    const nicheKeywords = (pref.nicheKeywords as string[]) || [];
    const platforms = (pref.platforms as string[]) || [];
    const alertTypes = (pref.alertTypes as string[]) || [];

    // Find recent trends matching user preferences
    const recentTrends = await prisma.viralTrend.findMany({
      where: {
        viralScore: { gte: pref.minViralScore },
        lastUpdatedAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) }, // last 4 hours
        ...(platforms.length > 0 ? { platform: { in: platforms } } : {}),
      },
      orderBy: { viralScore: 'desc' },
      take: 50,
    });

    for (const trend of recentTrends) {
      // Check if alert already exists for this user+trend combo
      const existing = await prisma.trendAlert.findFirst({
        where: {
          userId: pref.userId,
          trendId: trend.id,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (existing) continue;

      const alertType = determineAlertType(trend, nicheKeywords, alertTypes);
      if (!alertType) continue;

      await prisma.trendAlert.create({
        data: {
          userId: pref.userId,
          trendId: trend.id,
          alertType,
          title: buildAlertTitle(alertType, trend.title),
          description: buildAlertDescription(alertType, trend),
          severity: trend.viralScore > 80 ? 'critical' : trend.viralScore > 50 ? 'warning' : 'info',
          metadata: {
            viralScore: trend.viralScore,
            platform: trend.platform,
            lifecycle: trend.lifecycle,
            velocity: trend.velocity,
          },
        },
      });
      alertsCreated++;

      // Send webhook if configured
      if (pref.webhookUrl && pref.digestFrequency === 'realtime') {
        await sendWebhook(pref.webhookUrl, {
          type: alertType,
          trend: { title: trend.title, platform: trend.platform, viralScore: trend.viralScore },
        }).catch(() => {}); // Don't fail on webhook errors
      }
    }
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
  } = {}
) {
  const { alertType, unreadOnly = false, limit = 50, offset = 0 } = options;

  const where: Record<string, unknown> = { userId };
  if (alertType) where.alertType = alertType;
  if (unreadOnly) where.readAt = null;

  const [alerts, total] = await Promise.all([
    prisma.trendAlert.findMany({
      where,
      include: { trend: { select: { id: true, title: true, platform: true, viralScore: true, lifecycle: true } } },
      orderBy: { createdAt: 'desc' },
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
  period: 'daily' | 'weekly'
): Promise<TrendDigest> {
  const hoursBack = period === 'daily' ? 24 : 168;
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
    orderBy: { viralScore: 'desc' },
    take: 10,
  });

  // Niche matches
  const nicheMatches = nicheKeywords.length > 0
    ? await findNicheMatches(nicheKeywords, platforms, since)
    : [];

  // Trending hashtags
  const trendingHashtags = await prisma.hashtag.findMany({
    where: {
      trendDirection: 'rising',
      lastUpdatedAt: { gte: since },
      ...(platforms.length > 0 ? { platform: { in: platforms } } : {}),
    },
    orderBy: { reach: 'desc' },
    take: 10,
  });

  return {
    userId,
    period,
    topTrends: topTrends.map((t) => ({
      title: t.title,
      platform: t.platform,
      viralScore: t.viralScore,
      lifecycle: t.lifecycle as 'emerging' | 'rising' | 'peaking' | 'declining' | 'expired',
    })),
    nicheMatches: nicheMatches.map((m) => ({
      title: m.title,
      matchedKeyword: m.keyword,
      viralScore: m.viralScore,
    })),
    hashtagInsights: trendingHashtags.map((h) => ({
      tag: h.tag,
      direction: h.trendDirection as 'rising' | 'stable' | 'declining',
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
  }
) {
  return prisma.trendAlertPreference.upsert({
    where: { userId_businessId: { userId, businessId } },
    update: data,
    create: {
      userId,
      businessId,
      ...data,
    },
  });
}

function determineAlertType(
  trend: { title: string; lifecycle: string; viralScore: number; category: string | null },
  nicheKeywords: string[],
  enabledTypes: string[]
): TrendAlertType | null {
  const titleLower = trend.title.toLowerCase();

  // Check niche match
  if (enabledTypes.includes('niche_match')) {
    const matched = nicheKeywords.some((kw) => titleLower.includes(kw.toLowerCase()));
    if (matched) return 'niche_match';
  }

  // Check trend lifecycle alerts
  if (enabledTypes.includes('trend_emerging') && trend.lifecycle === 'emerging' && trend.viralScore > 30) {
    return 'trend_emerging';
  }

  if (enabledTypes.includes('trend_peaking') && trend.lifecycle === 'peaking') {
    return 'trend_peaking';
  }

  return null;
}

function buildAlertTitle(type: TrendAlertType, trendTitle: string): string {
  switch (type) {
    case 'trend_emerging': return `Emerging trend: ${trendTitle}`;
    case 'trend_peaking': return `Trend peaking now: ${trendTitle}`;
    case 'niche_match': return `Trend in your niche: ${trendTitle}`;
    case 'hashtag_trending': return `Hashtag trending: #${trendTitle}`;
  }
}

function buildAlertDescription(
  type: TrendAlertType,
  trend: { title: string; platform: string; viralScore: number; lifecycle: string }
): string {
  return `"${trend.title}" is ${trend.lifecycle} on ${trend.platform} with a viral score of ${Math.round(trend.viralScore)}/100. Consider creating content around this topic.`;
}

async function findNicheMatches(
  keywords: string[],
  platforms: string[],
  since: Date
): Promise<Array<{ title: string; keyword: string; viralScore: number }>> {
  const results: Array<{ title: string; keyword: string; viralScore: number }> = [];

  for (const keyword of keywords) {
    const trends = await prisma.viralTrend.findMany({
      where: {
        title: { contains: keyword, mode: 'insensitive' },
        lastUpdatedAt: { gte: since },
        ...(platforms.length > 0 ? { platform: { in: platforms } } : {}),
      },
      orderBy: { viralScore: 'desc' },
      take: 3,
    });

    for (const t of trends) {
      results.push({ title: t.title, keyword, viralScore: t.viralScore });
    }
  }

  return results.sort((a, b) => b.viralScore - a.viralScore).slice(0, 10);
}

async function sendWebhook(url: string, payload: unknown): Promise<void> {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
}
