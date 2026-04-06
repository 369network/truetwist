import { prisma } from '@/lib/prisma';
import type { Platform } from '@/lib/social/types';
import type { WeeklyInsights } from './types';

/**
 * Generates weekly AI-powered performance insights with actionable recommendations.
 */
export async function generateWeeklyInsights(
  userId: string,
  businessId: string,
  socialAccountIds: string[]
): Promise<WeeklyInsights> {
  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(thisWeekStart.getDate() - 7);
  thisWeekStart.setUTCHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const weekStartStr = thisWeekStart.toISOString().slice(0, 10);
  const weekEndStr = now.toISOString().slice(0, 10);

  // Fetch this week's posted schedules with analytics
  const thisWeekSchedules = await prisma.postSchedule.findMany({
    where: {
      socialAccountId: { in: socialAccountIds },
      status: 'posted',
      postedAt: { gte: thisWeekStart, lte: now },
    },
    include: {
      post: { select: { contentType: true, contentText: true, id: true } },
      analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
    },
    orderBy: { postedAt: 'desc' },
  });

  // Fetch last week's schedules for comparison
  const lastWeekSchedules = await prisma.postSchedule.findMany({
    where: {
      socialAccountId: { in: socialAccountIds },
      status: 'posted',
      postedAt: { gte: lastWeekStart, lt: thisWeekStart },
    },
    include: {
      analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
    },
  });

  // Calculate engagement scores
  const thisWeekEngagement = calculateTotalEngagement(thisWeekSchedules);
  const lastWeekEngagement = calculateTotalEngagement(lastWeekSchedules);
  const changePercent = lastWeekEngagement > 0
    ? ((thisWeekEngagement - lastWeekEngagement) / lastWeekEngagement) * 100
    : thisWeekEngagement > 0 ? 100 : 0;

  // Identify what worked - group by content type and find top patterns
  const whatWorked = identifyWhatWorked(thisWeekSchedules);

  // Find top-performing posts
  const topPerformingPosts = thisWeekSchedules
    .filter((s) => s.analytics[0])
    .map((s) => {
      const a = s.analytics[0]!;
      return {
        postId: s.post.id,
        platform: s.platform as Platform,
        engagementScore: a.likes + a.comments * 3 + a.shares * 5 + a.saves * 4 + a.clicks * 2,
        contentType: s.post.contentType,
        postedAt: s.postedAt!,
      };
    })
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 5);

  // Detect anomalies (significant changes in metrics by platform)
  const anomalies = detectAnomalies(thisWeekSchedules, lastWeekSchedules);

  // Generate "what to try next week" suggestions
  const whatToTryNextWeek = generateNextWeekSuggestions(
    thisWeekSchedules,
    topPerformingPosts,
    changePercent
  );

  // Build summary
  const postCount = thisWeekSchedules.length;
  const avgEngagement = postCount > 0 ? thisWeekEngagement / postCount : 0;
  const direction = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'steady';
  const summary = buildSummary(postCount, avgEngagement, changePercent, direction);

  return {
    userId,
    businessId,
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    summary,
    whatWorked,
    whatToTryNextWeek,
    anomalies,
    topPerformingPosts,
    overallEngagement: {
      thisWeek: Math.round(thisWeekEngagement),
      lastWeek: Math.round(lastWeekEngagement),
      changePercent: Math.round(changePercent * 10) / 10,
    },
  };
}

function calculateTotalEngagement(
  schedules: Array<{ analytics: Array<{ likes: number; comments: number; shares: number; saves: number; clicks: number }> }>
): number {
  return schedules.reduce((total, s) => {
    if (!s.analytics[0]) return total;
    const a = s.analytics[0];
    return total + a.likes + a.comments * 3 + a.shares * 5 + a.saves * 4 + a.clicks * 2;
  }, 0);
}

function identifyWhatWorked(
  schedules: Array<{
    platform: string;
    post: { contentType: string; contentText: string | null };
    analytics: Array<{ likes: number; comments: number; shares: number; saves: number; clicks: number; reach: number }>;
    postedAt: Date | null;
  }>
): WeeklyInsights['whatWorked'] {
  // Group by content type + platform
  const groups: Record<string, { totalEngagement: number; count: number; totalReach: number }> = {};

  for (const s of schedules) {
    if (!s.analytics[0]) continue;
    const a = s.analytics[0];
    const engagement = a.likes + a.comments * 3 + a.shares * 5 + a.saves * 4 + a.clicks * 2;
    const key = `${s.post.contentType} on ${s.platform}`;

    if (!groups[key]) groups[key] = { totalEngagement: 0, count: 0, totalReach: 0 };
    groups[key].totalEngagement += engagement;
    groups[key].count += 1;
    groups[key].totalReach += a.reach;
  }

  return Object.entries(groups)
    .map(([pattern, data]) => ({
      pattern,
      evidence: `${data.count} post(s) with avg engagement score ${Math.round(data.totalEngagement / data.count)} and ${Math.round(data.totalReach / data.count)} avg reach`,
      postsCount: data.count,
    }))
    .sort((a, b) => {
      const aAvg = groups[a.pattern].totalEngagement / groups[a.pattern].count;
      const bAvg = groups[b.pattern].totalEngagement / groups[b.pattern].count;
      return bAvg - aAvg;
    })
    .slice(0, 5);
}

function detectAnomalies(
  thisWeek: Array<{ platform: string; analytics: Array<{ likes: number; comments: number; shares: number; impressions: number; reach: number; saves: number; clicks: number }> }>,
  lastWeek: Array<{ platform: string; analytics: Array<{ likes: number; comments: number; shares: number; impressions: number; reach: number; saves: number; clicks: number }> }>
): WeeklyInsights['anomalies'] {
  const anomalies: WeeklyInsights['anomalies'] = [];

  // Group metrics by platform
  const metrics = ['likes', 'comments', 'shares', 'impressions', 'reach'] as const;
  const platforms = Array.from(new Set([...thisWeek.map((s) => s.platform), ...lastWeek.map((s) => s.platform)]));

  for (const platform of platforms) {
    for (const metric of metrics) {
      const thisWeekTotal = thisWeek
        .filter((s) => s.platform === platform && s.analytics[0])
        .reduce((sum, s) => sum + (s.analytics[0]?.[metric] ?? 0), 0);
      const lastWeekTotal = lastWeek
        .filter((s) => s.platform === platform && s.analytics[0])
        .reduce((sum, s) => sum + (s.analytics[0]?.[metric] ?? 0), 0);

      if (lastWeekTotal === 0) continue;

      const change = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;

      // Flag changes > 50% as anomalies
      if (Math.abs(change) > 50) {
        const type = change > 0 ? 'spike' as const : 'drop' as const;
        anomalies.push({
          type,
          metric,
          platform: platform as Platform,
          change: Math.round(change),
          explanation: type === 'spike'
            ? `${metric} on ${platform} spiked ${Math.round(change)}% vs last week. Check if a post went viral or if you increased posting frequency.`
            : `${metric} on ${platform} dropped ${Math.round(Math.abs(change))}% vs last week. Consider posting more frequently or adjusting content strategy.`,
        });
      }
    }
  }

  return anomalies.slice(0, 5);
}

function generateNextWeekSuggestions(
  thisWeekSchedules: Array<{
    platform: string;
    post: { contentType: string };
    analytics: Array<{ likes: number; comments: number; shares: number; saves: number; clicks: number }>;
  }>,
  topPosts: WeeklyInsights['topPerformingPosts'],
  changePercent: number
): WeeklyInsights['whatToTryNextWeek'] {
  const suggestions: WeeklyInsights['whatToTryNextWeek'] = [];

  // If engagement dropped, suggest changes
  if (changePercent < -10) {
    suggestions.push({
      suggestion: 'Experiment with different posting times',
      reasoning: `Engagement dropped ${Math.abs(Math.round(changePercent))}% this week. Try posting at different times to find when your audience is most active.`,
    });
  }

  // If a content type performed well, suggest more of it
  if (topPosts.length > 0) {
    const topType = topPosts[0].contentType;
    suggestions.push({
      suggestion: `Create more ${topType} content`,
      reasoning: `Your top post this week was ${topType} format with an engagement score of ${topPosts[0].engagementScore}. Double down on what works.`,
    });
  }

  // Check for underutilized platforms
  const activePlatforms = new Set(thisWeekSchedules.map((s) => s.platform));
  const allPlatforms = ['instagram', 'tiktok', 'twitter', 'facebook', 'linkedin'];
  for (const platform of allPlatforms) {
    if (!activePlatforms.has(platform)) {
      suggestions.push({
        suggestion: `Start posting on ${platform}`,
        reasoning: `You didn't post on ${platform} this week. Cross-platform presence expands your reach to new audiences.`,
      });
      break; // Only suggest one missing platform
    }
  }

  // Content variety suggestion
  const contentTypes = thisWeekSchedules.map((s) => s.post.contentType);
  const uniqueTypes = new Set(contentTypes);
  if (uniqueTypes.size <= 1 && contentTypes.length >= 3) {
    suggestions.push({
      suggestion: 'Diversify your content formats',
      reasoning: `All ${contentTypes.length} posts this week were ${contentTypes[0]} format. Try mixing in videos, carousels, or stories for better reach.`,
    });
  }

  // Engagement strategy suggestion
  const hasHighComments = thisWeekSchedules.some(
    (s) => s.analytics[0] && s.analytics[0].comments > s.analytics[0].likes * 0.1
  );
  if (!hasHighComments && thisWeekSchedules.length > 0) {
    suggestions.push({
      suggestion: 'Add conversation starters to your posts',
      reasoning: 'Comment rates are low relative to likes. Try ending posts with questions or polls to encourage discussion.',
    });
  }

  return suggestions.slice(0, 5);
}

function buildSummary(
  postCount: number,
  avgEngagement: number,
  changePercent: number,
  direction: 'up' | 'down' | 'steady'
): string {
  if (postCount === 0) {
    return 'No posts were published this week. Consider creating content to maintain audience engagement and algorithmic visibility.';
  }

  const directionText = direction === 'up'
    ? `up ${Math.round(changePercent)}%`
    : direction === 'down'
      ? `down ${Math.round(Math.abs(changePercent))}%`
      : 'roughly steady';

  return `You published ${postCount} post(s) this week with an average engagement score of ${Math.round(avgEngagement)}. Overall engagement is ${directionText} compared to last week.`;
}
