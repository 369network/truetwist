import { prisma } from '@/lib/prisma';
import type { NormalizedTrend, TrendSource, TrendCollectionResult } from './types';
import { collectTrends } from './collectors';
import { computeSimpleViralScore } from './viral-score';

/**
 * Runs a full trend collection cycle for a given source and region.
 * 1. Fetches trends from the source API
 * 2. Upserts trends into the database (dedup by platform+source+title+region)
 * 3. Creates time-series snapshots for lifecycle tracking
 * 4. Updates hashtag associations
 * 5. Records the collection job result
 */
export async function runCollectionPipeline(
  source: TrendSource,
  region: string,
  jobDbId: string
): Promise<TrendCollectionResult> {
  const result: TrendCollectionResult = {
    source,
    region,
    trendsFound: 0,
    trendsUpdated: 0,
    errors: [],
  };

  // Mark job as running
  await prisma.trendCollectionJob.update({
    where: { id: jobDbId },
    data: { status: 'running', startedAt: new Date() },
  });

  try {
    const rawTrends = await collectTrends(source, region);
    result.trendsFound = rawTrends.length;

    for (const trend of rawTrends) {
      try {
        await upsertTrend(trend);
        result.trendsUpdated++;
      } catch (err) {
        result.errors.push(`Failed to upsert "${trend.title}": ${(err as Error).message}`);
      }
    }

    // Mark job as completed
    await prisma.trendCollectionJob.update({
      where: { id: jobDbId },
      data: {
        status: 'completed',
        trendsFound: result.trendsFound,
        trendsUpdated: result.trendsUpdated,
        completedAt: new Date(),
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
      },
    });
  } catch (err) {
    const errorMessage = (err as Error).message;
    result.errors.push(errorMessage);

    await prisma.trendCollectionJob.update({
      where: { id: jobDbId },
      data: {
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
      },
    });
  }

  return result;
}

async function upsertTrend(trend: NormalizedTrend): Promise<void> {
  const volume = Object.values(trend.engagementMetrics)[0] ?? 0;
  const viralScore = computeSimpleViralScore(volume, trend.velocity, trend.platform);

  // Upsert the trend record
  const dbTrend = await prisma.viralTrend.upsert({
    where: {
      platform_source_title_region: {
        platform: trend.platform,
        source: trend.source,
        title: trend.title.slice(0, 255),
        region: trend.region,
      },
    },
    update: {
      description: trend.description,
      exampleUrls: trend.exampleUrls,
      engagementMetrics: trend.engagementMetrics,
      viralScore,
      velocity: trend.velocity,
      sentiment: trend.sentiment,
      rawPayload: trend.rawPayload,
      lastUpdatedAt: new Date(),
    },
    create: {
      platform: trend.platform,
      source: trend.source,
      title: trend.title.slice(0, 255),
      category: trend.category,
      description: trend.description,
      exampleUrls: trend.exampleUrls,
      engagementMetrics: trend.engagementMetrics,
      viralScore,
      velocity: trend.velocity,
      sentiment: trend.sentiment,
      region: trend.region,
      rawPayload: trend.rawPayload,
    },
  });

  // Create a time-series snapshot
  await prisma.trendSnapshot.create({
    data: {
      trendId: dbTrend.id,
      viralScore,
      velocity: trend.velocity,
      volume,
      sentiment: trend.sentiment,
    },
  });

  // Upsert associated hashtags
  for (const tag of trend.hashtags.slice(0, 20)) {
    const hashtag = await prisma.hashtag.upsert({
      where: { tag_platform: { tag, platform: trend.platform } },
      update: { lastUpdatedAt: new Date() },
      create: { tag, platform: trend.platform },
    });

    await prisma.trendHashtag.upsert({
      where: { trendId_hashtagId: { trendId: dbTrend.id, hashtagId: hashtag.id } },
      update: { relevance: 0.5 },
      create: { trendId: dbTrend.id, hashtagId: hashtag.id, relevance: 0.5 },
    });
  }

  // Update lifecycle based on snapshots
  await updateTrendLifecycle(dbTrend.id);
}

/**
 * Analyzes recent snapshots to determine trend lifecycle stage.
 */
async function updateTrendLifecycle(trendId: string): Promise<void> {
  const snapshots = await prisma.trendSnapshot.findMany({
    where: { trendId },
    orderBy: { snapshotAt: 'desc' },
    take: 10,
  });

  if (snapshots.length < 2) return;

  const latest = snapshots[0];
  const previous = snapshots[1];
  const acceleration = latest.velocity - previous.velocity;
  const trend = await prisma.viralTrend.findUnique({ where: { id: trendId } });
  if (!trend) return;

  let lifecycle: string = trend.lifecycle;
  let peakedAt = trend.peakedAt;

  if (latest.viralScore < 5) {
    lifecycle = 'expired';
  } else if (acceleration > 0.5) {
    lifecycle = snapshots.length < 3 ? 'emerging' : 'rising';
  } else if (acceleration < -0.3) {
    lifecycle = 'declining';
  } else if (latest.viralScore > 60 && Math.abs(acceleration) <= 0.5) {
    lifecycle = 'peaking';
    if (!peakedAt) peakedAt = new Date();
  }

  await prisma.viralTrend.update({
    where: { id: trendId },
    data: { lifecycle, acceleration, peakedAt },
  });
}
