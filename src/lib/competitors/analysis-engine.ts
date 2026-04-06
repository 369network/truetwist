import { prisma } from '@/lib/prisma';
import type {
  CompetitorBenchmark,
  ContentGap,
  CompetitiveComparison,
  IntelligenceReport,
} from './types';

/**
 * Computes engagement rate benchmarks: user's metrics vs all competitors for a business.
 */
export async function computeBenchmarks(
  businessId: string,
  userAccountIds: string[]
): Promise<CompetitorBenchmark[]> {
  // Get user's average metrics across their social accounts
  const userAnalytics = await prisma.postAnalytics.findMany({
    where: {
      postSchedule: {
        socialAccountId: { in: userAccountIds },
        status: 'posted',
      },
    },
    orderBy: { fetchedAt: 'desc' },
    take: 100,
  });

  const userEngagement = userAnalytics.length > 0
    ? userAnalytics.reduce((s, a) => s + a.engagementRate, 0) / userAnalytics.length
    : 0;
  const userAvgLikes = userAnalytics.length > 0
    ? userAnalytics.reduce((s, a) => s + a.likes, 0) / userAnalytics.length
    : 0;
  const userAvgComments = userAnalytics.length > 0
    ? userAnalytics.reduce((s, a) => s + a.comments, 0) / userAnalytics.length
    : 0;
  const userAvgShares = userAnalytics.length > 0
    ? userAnalytics.reduce((s, a) => s + a.shares, 0) / userAnalytics.length
    : 0;

  // Get user's follower count
  const userAccounts = await prisma.socialAccount.findMany({
    where: { id: { in: userAccountIds } },
  });
  const userFollowers = userAccounts.reduce((s, a) => s + a.followerCount, 0);

  // Get user's posting frequency
  const recentPosts = await prisma.postSchedule.count({
    where: {
      socialAccountId: { in: userAccountIds },
      status: 'posted',
      postedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });
  const userPostingFrequency = (recentPosts / 30) * 7; // posts per week

  // Get all competitor accounts for this business
  const competitorAccounts = await prisma.competitorAccount.findMany({
    where: { competitor: { businessId } },
    include: { competitor: true },
  });

  if (competitorAccounts.length === 0) {
    return [];
  }

  const benchmarks: CompetitorBenchmark[] = [];

  // Engagement rate benchmark
  const compEngagements = competitorAccounts.map(a => a.engagementRate);
  const compAvgEngagement = compEngagements.reduce((s, v) => s + v, 0) / compEngagements.length;
  const bestEngagement = competitorAccounts.reduce((best, a) =>
    a.engagementRate > best.engagementRate ? a : best
  );
  benchmarks.push({
    metric: 'engagement_rate',
    userValue: userEngagement,
    competitorAvg: compAvgEngagement,
    competitorBest: bestEngagement.engagementRate,
    competitorBestName: bestEngagement.competitor.name,
    percentile: calculatePercentile(userEngagement, compEngagements),
  });

  // Follower count benchmark
  const compFollowers = competitorAccounts.map(a => a.followerCount);
  const bestFollowers = competitorAccounts.reduce((best, a) =>
    a.followerCount > best.followerCount ? a : best
  );
  benchmarks.push({
    metric: 'followers',
    userValue: userFollowers,
    competitorAvg: compFollowers.reduce((s, v) => s + v, 0) / compFollowers.length,
    competitorBest: bestFollowers.followerCount,
    competitorBestName: bestFollowers.competitor.name,
    percentile: calculatePercentile(userFollowers, compFollowers),
  });

  // Average likes benchmark
  const compLikes = competitorAccounts.map(a => a.avgLikes);
  const bestLikes = competitorAccounts.reduce((best, a) =>
    a.avgLikes > best.avgLikes ? a : best
  );
  benchmarks.push({
    metric: 'avg_likes',
    userValue: userAvgLikes,
    competitorAvg: compLikes.reduce((s, v) => s + v, 0) / compLikes.length,
    competitorBest: bestLikes.avgLikes,
    competitorBestName: bestLikes.competitor.name,
    percentile: calculatePercentile(userAvgLikes, compLikes),
  });

  // Average comments benchmark
  const compComments = competitorAccounts.map(a => a.avgComments);
  const bestComments = competitorAccounts.reduce((best, a) =>
    a.avgComments > best.avgComments ? a : best
  );
  benchmarks.push({
    metric: 'avg_comments',
    userValue: userAvgComments,
    competitorAvg: compComments.reduce((s, v) => s + v, 0) / compComments.length,
    competitorBest: bestComments.avgComments,
    competitorBestName: bestComments.competitor.name,
    percentile: calculatePercentile(userAvgComments, compComments),
  });

  // Posting frequency benchmark
  const compFreqs = competitorAccounts.map(a => a.postingFrequency);
  const bestFreq = competitorAccounts.reduce((best, a) =>
    a.postingFrequency > best.postingFrequency ? a : best
  );
  benchmarks.push({
    metric: 'posting_frequency',
    userValue: userPostingFrequency,
    competitorAvg: compFreqs.reduce((s, v) => s + v, 0) / compFreqs.length,
    competitorBest: bestFreq.postingFrequency,
    competitorBestName: bestFreq.competitor.name,
    percentile: calculatePercentile(userPostingFrequency, compFreqs),
  });

  return benchmarks;
}

/**
 * Identifies content types and topics that competitors use but the user doesn't.
 */
export async function computeContentGaps(
  businessId: string,
  userId: string
): Promise<ContentGap[]> {
  // Get user's content type distribution
  const userPosts = await prisma.post.findMany({
    where: { businessId, userId },
    select: { contentType: true },
  });

  const userMix: Record<string, number> = {};
  for (const post of userPosts) {
    userMix[post.contentType] = (userMix[post.contentType] || 0) + 1;
  }
  const userTotal = userPosts.length || 1;

  // Get competitor content type distribution
  const competitorAccounts = await prisma.competitorAccount.findMany({
    where: { competitor: { businessId } },
    select: { contentMix: true, competitor: { select: { name: true } } },
  });

  // Aggregate competitor content mix
  const contentTypes: Record<string, boolean> = {};
  const competitorMixByType: Record<string, { total: number; count: number; competitors: string[] }> = {};

  for (const account of competitorAccounts) {
    const mix = account.contentMix as Record<string, number>;
    for (const [type, percent] of Object.entries(mix)) {
      contentTypes[type] = true;
      if (!competitorMixByType[type]) {
        competitorMixByType[type] = { total: 0, count: 0, competitors: [] };
      }
      competitorMixByType[type].total += percent;
      competitorMixByType[type].count++;
      competitorMixByType[type].competitors.push(account.competitor.name);
    }
  }

  // Also include user content types
  for (const type of Object.keys(userMix)) {
    contentTypes[type] = true;
  }

  const gaps: ContentGap[] = [];
  for (const type of Object.keys(contentTypes)) {
    const userPercent = userTotal > 0 ? ((userMix[type] || 0) / userTotal) * 100 : 0;
    const compData = competitorMixByType[type];
    const compPercent = compData ? compData.total / compData.count : 0;
    const gap = compPercent - userPercent;

    // Deduplicate competitor names
    const uniqueCompetitors = compData
      ? compData.competitors.filter((v, i, a) => a.indexOf(v) === i).slice(0, 5)
      : [];

    gaps.push({
      contentType: type,
      competitorUsagePercent: Math.round(compPercent * 10) / 10,
      userUsagePercent: Math.round(userPercent * 10) / 10,
      gap: Math.round(gap * 10) / 10,
      topCompetitors: uniqueCompetitors,
    });
  }

  return gaps.sort((a, b) => b.gap - a.gap);
}

/**
 * Builds a full competitive comparison report.
 */
export async function buildCompetitiveComparison(
  businessId: string,
  userId: string,
  userAccountIds: string[]
): Promise<CompetitiveComparison> {
  const [benchmarks, contentGaps] = await Promise.all([
    computeBenchmarks(businessId, userAccountIds),
    computeContentGaps(businessId, userId),
  ]);

  const freqBenchmark = benchmarks.find(b => b.metric === 'posting_frequency');

  return {
    userId,
    businessId,
    period: 'last_30_days',
    benchmarks,
    contentGaps,
    postingFrequencyComparison: {
      user: freqBenchmark?.userValue ?? 0,
      competitorAvg: freqBenchmark?.competitorAvg ?? 0,
      competitorBest: {
        name: freqBenchmark?.competitorBestName ?? '',
        frequency: freqBenchmark?.competitorBest ?? 0,
      },
    },
  };
}

/**
 * Detects trend changes by comparing recent snapshots for a competitor account.
 */
export async function detectTrend(
  competitorAccountId: string,
  metric: 'followerCount' | 'engagementRate' | 'postingFrequency',
  windowDays = 30
): Promise<'up' | 'down' | 'stable'> {
  const snapshots = await prisma.competitorAccountSnapshot.findMany({
    where: {
      competitorAccountId,
      snapshotAt: { gte: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000) },
    },
    orderBy: { snapshotAt: 'asc' },
  });

  if (snapshots.length < 2) return 'stable';

  const first = snapshots[0][metric];
  const last = snapshots[snapshots.length - 1][metric];
  const changePercent = first > 0 ? (last - first) / first : 0;

  if (changePercent > 0.05) return 'up';
  if (changePercent < -0.05) return 'down';
  return 'stable';
}

/**
 * Generates an AI-summarized weekly competitive intelligence report.
 */
export async function generateIntelligenceReport(businessId: string): Promise<IntelligenceReport> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const competitors = await prisma.competitor.findMany({
    where: { businessId },
    include: {
      accounts: {
        include: {
          posts: {
            where: { postedAt: { gte: thirtyDaysAgo } },
            orderBy: { likes: 'desc' },
            take: 5,
          },
          snapshots: {
            where: { snapshotAt: { gte: thirtyDaysAgo } },
            orderBy: { snapshotAt: 'asc' },
          },
        },
      },
    },
  });

  const business = await prisma.business.findUnique({ where: { id: businessId } });

  const competitorHighlights = await Promise.all(
    competitors.map(async (comp) => {
      const allSnapshots = comp.accounts.flatMap(a => a.snapshots);
      const firstFollowers = allSnapshots.length > 0
        ? allSnapshots[0].followerCount
        : comp.accounts.reduce((s, a) => s + a.followerCount, 0);
      const lastFollowers = comp.accounts.reduce((s, a) => s + a.followerCount, 0);
      const followerGrowth = firstFollowers > 0
        ? ((lastFollowers - firstFollowers) / firstFollowers) * 100
        : 0;

      const topPost = comp.accounts
        .flatMap(a => a.posts)
        .sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))[0];

      // Detect engagement trend
      const engagementTrends = await Promise.all(
        comp.accounts.map(a => detectTrend(a.id, 'engagementRate'))
      );
      const overallTrend = engagementTrends.includes('up')
        ? 'up' as const
        : engagementTrends.includes('down')
          ? 'down' as const
          : 'stable' as const;

      const strategyNotes: string[] = [];
      for (const account of comp.accounts) {
        if (account.postingFrequency > 7) {
          strategyNotes.push(`High posting frequency on ${account.platform} (${account.postingFrequency.toFixed(1)}/week)`);
        }
        const mix = account.contentMix as Record<string, number>;
        const dominantType = Object.entries(mix).sort((a, b) => b[1] - a[1])[0];
        if (dominantType && dominantType[1] > 60) {
          strategyNotes.push(`Focuses on ${dominantType[0]} content on ${account.platform} (${dominantType[1]}%)`);
        }
      }

      return {
        competitorName: comp.name,
        followerGrowth: Math.round(followerGrowth * 10) / 10,
        engagementTrend: overallTrend,
        topPost: topPost
          ? { text: topPost.contentText || '', engagement: topPost.likes + topPost.comments + topPost.shares }
          : null,
        strategyNotes,
      };
    })
  );

  // Generate content gaps
  const contentGaps = business
    ? await computeContentGaps(businessId, business.userId)
    : [];

  // Build key findings
  const keyFindings: string[] = [];
  const growingCompetitors = competitorHighlights.filter(c => c.followerGrowth > 10);
  if (growingCompetitors.length > 0) {
    keyFindings.push(`${growingCompetitors.length} competitor(s) showing significant follower growth (>10%): ${growingCompetitors.map(c => c.competitorName).join(', ')}`);
  }
  const decliningEngagement = competitorHighlights.filter(c => c.engagementTrend === 'down');
  if (decliningEngagement.length > 0) {
    keyFindings.push(`${decliningEngagement.length} competitor(s) with declining engagement: ${decliningEngagement.map(c => c.competitorName).join(', ')}`);
  }
  const significantGaps = contentGaps.filter(g => g.gap > 20);
  if (significantGaps.length > 0) {
    keyFindings.push(`Content gaps identified: competitors use ${significantGaps.map(g => g.contentType).join(', ')} content significantly more`);
  }

  // Build recommendations
  const recommendations: string[] = [];
  if (significantGaps.length > 0) {
    recommendations.push(`Consider creating more ${significantGaps[0].contentType} content — competitors average ${significantGaps[0].competitorUsagePercent}% vs your ${significantGaps[0].userUsagePercent}%`);
  }
  for (const highlight of competitorHighlights) {
    if (highlight.topPost && highlight.topPost.engagement > 0) {
      recommendations.push(`Study ${highlight.competitorName}'s top-performing content for inspiration`);
    }
  }
  if (growingCompetitors.length > 0) {
    recommendations.push(`Monitor ${growingCompetitors[0].competitorName} closely — they grew ${growingCompetitors[0].followerGrowth}% this period`);
  }

  return {
    businessId,
    generatedAt: new Date(),
    period: 'last_30_days',
    summary: `Competitive intelligence report for ${business?.name || 'your business'} covering ${competitors.length} tracked competitor(s) over the last 30 days.`,
    keyFindings,
    competitorHighlights,
    recommendations,
    contentGaps: significantGaps,
  };
}

// --- Helpers ---

function calculatePercentile(value: number, distribution: number[]): number {
  if (distribution.length === 0) return 50;
  const below = distribution.filter(v => v < value).length;
  return Math.round((below / distribution.length) * 100);
}
