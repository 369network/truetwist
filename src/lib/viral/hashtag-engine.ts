import { prisma } from '@/lib/prisma';
import type { HashtagRecommendation, HashtagAnalysisResult, CompetitionLevel, TrendDirection } from './types';

/**
 * Hashtag Analysis Engine
 * - Trending hashtag collection per platform
 * - Performance metrics: reach, competition level, trend direction
 * - Related hashtag clustering
 * - Recommendation API: given a topic, return optimized hashtag set per platform
 * - Banned/shadowbanned hashtag detection
 */

/**
 * Returns optimized hashtag recommendations for a given topic and platform.
 * Balances high-reach trending tags with lower-competition niche tags.
 */
export async function getHashtagRecommendations(
  topic: string,
  platform: string,
  limit: number = 30
): Promise<HashtagAnalysisResult> {
  const keywords = topic.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  // Find hashtags related to the topic
  const relatedHashtags = await prisma.hashtag.findMany({
    where: {
      platform,
      isBanned: false,
      OR: [
        { tag: { in: keywords } },
        { category: { in: keywords } },
        { relatedTags: { array_contains: keywords } },
      ],
    },
    orderBy: [{ trendDirection: 'asc' }, { reach: 'desc' }],
    take: limit * 2,
  });

  // Also find currently trending hashtags on this platform
  const trendingHashtags = await prisma.hashtag.findMany({
    where: {
      platform,
      isBanned: false,
      trendDirection: 'rising',
    },
    orderBy: { reach: 'desc' },
    take: 20,
  });

  // Find banned hashtags that might match
  const bannedHashtags = await prisma.hashtag.findMany({
    where: {
      platform,
      isBanned: true,
      tag: { in: keywords },
    },
    select: { tag: true },
  });

  const toRecommendation = (h: {
    tag: string;
    platform: string;
    reach: number;
    competitionLevel: string;
    trendDirection: string;
    isBanned: boolean;
  }, relevance: number): HashtagRecommendation => ({
    tag: h.tag,
    platform: h.platform,
    reach: h.reach,
    competitionLevel: h.competitionLevel as CompetitionLevel,
    trendDirection: h.trendDirection as TrendDirection,
    relevanceScore: relevance,
    isBanned: h.isBanned,
  });

  // Score and sort recommendations
  const scored = relatedHashtags.map((h) => {
    const relevance = computeRelevance(h.tag, keywords, h.reach, h.competitionLevel, h.trendDirection);
    return toRecommendation(h, relevance);
  });
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Split into categories
  const recommended = scored.slice(0, limit);
  const trending = trendingHashtags.map((h) => toRecommendation(h, 0.5));
  const niche = scored.filter((h) => h.competitionLevel === 'low' || h.competitionLevel === 'medium').slice(0, 10);

  return {
    recommended,
    trending,
    niche,
    banned: bannedHashtags.map((h) => h.tag),
  };
}

/**
 * Updates hashtag metrics: reach, competition, trend direction.
 * Called after trend collection to keep hashtag data fresh.
 */
export async function refreshHashtagMetrics(platform: string): Promise<number> {
  const hashtags = await prisma.hashtag.findMany({
    where: { platform },
    include: {
      trendHashtags: {
        include: {
          trend: {
            select: { viralScore: true, velocity: true, lifecycle: true },
          },
        },
      },
    },
  });

  let updated = 0;
  for (const hashtag of hashtags) {
    const trendData = hashtag.trendHashtags.map((th) => th.trend);
    if (trendData.length === 0) continue;

    const avgScore = trendData.reduce((sum, t) => sum + t.viralScore, 0) / trendData.length;
    const avgVelocity = trendData.reduce((sum, t) => sum + t.velocity, 0) / trendData.length;

    const competitionLevel = computeCompetitionLevel(hashtag.postCount, hashtag.reach);
    const trendDirection = computeTrendDirection(avgVelocity, trendData);

    await prisma.hashtag.update({
      where: { id: hashtag.id },
      data: {
        competitionLevel,
        trendDirection,
        lastUpdatedAt: new Date(),
      },
    });
    updated++;
  }

  return updated;
}

/**
 * Detects potentially banned/shadowbanned hashtags.
 * A hashtag is flagged if it appears in trends but has abnormally low reach.
 */
export async function detectBannedHashtags(platform: string): Promise<string[]> {
  const suspicious = await prisma.hashtag.findMany({
    where: {
      platform,
      isBanned: false,
      postCount: { gt: 1000 },
      reach: { lt: 100 },
    },
  });

  const flagged: string[] = [];
  for (const h of suspicious) {
    await prisma.hashtag.update({
      where: { id: h.id },
      data: { isBanned: true },
    });
    flagged.push(h.tag);
  }

  return flagged;
}

/**
 * Finds clusters of related hashtags using co-occurrence in trends.
 */
export async function getRelatedHashtags(
  tag: string,
  platform: string,
  limit: number = 10
): Promise<HashtagRecommendation[]> {
  const hashtag = await prisma.hashtag.findUnique({
    where: { tag_platform: { tag, platform } },
    include: {
      trendHashtags: { select: { trendId: true } },
    },
  });

  if (!hashtag) return [];

  const trendIds = hashtag.trendHashtags.map((th) => th.trendId);
  if (trendIds.length === 0) return [];

  // Find other hashtags that appear in the same trends
  const related = await prisma.trendHashtag.findMany({
    where: {
      trendId: { in: trendIds },
      hashtagId: { not: hashtag.id },
    },
    include: { hashtag: true },
    distinct: ['hashtagId'],
    take: limit,
  });

  return related.map((r) => ({
    tag: r.hashtag.tag,
    platform: r.hashtag.platform,
    reach: r.hashtag.reach,
    competitionLevel: r.hashtag.competitionLevel as CompetitionLevel,
    trendDirection: r.hashtag.trendDirection as TrendDirection,
    relevanceScore: r.relevance,
    isBanned: r.hashtag.isBanned,
  }));
}

function computeRelevance(
  tag: string,
  keywords: string[],
  reach: number,
  competition: string,
  direction: string
): number {
  let score = 0;

  // Direct keyword match
  if (keywords.includes(tag)) score += 0.4;

  // Reach score (log-scaled)
  score += Math.min(0.3, Math.log10(Math.max(reach, 1)) / 20);

  // Competition bonus (lower is better for niche)
  if (competition === 'low') score += 0.15;
  else if (competition === 'medium') score += 0.1;

  // Trending bonus
  if (direction === 'rising') score += 0.15;

  return Math.min(1, score);
}

function computeCompetitionLevel(postCount: number, reach: number): CompetitionLevel {
  const ratio = postCount > 0 ? reach / postCount : 0;
  if (postCount < 1000) return 'low';
  if (postCount < 50000 && ratio > 0.5) return 'medium';
  if (postCount < 500000) return 'high';
  return 'saturated';
}

function computeTrendDirection(
  avgVelocity: number,
  trends: Array<{ velocity: number; lifecycle: string }>
): TrendDirection {
  const risingCount = trends.filter((t) => t.lifecycle === 'emerging' || t.lifecycle === 'rising').length;
  const decliningCount = trends.filter((t) => t.lifecycle === 'declining' || t.lifecycle === 'expired').length;

  if (risingCount > decliningCount && avgVelocity > 0) return 'rising';
  if (decliningCount > risingCount) return 'declining';
  return 'stable';
}
