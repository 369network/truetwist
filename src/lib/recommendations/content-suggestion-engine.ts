import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/ai/openai-client';
import { smartScheduler } from '@/lib/scheduling';
import type { Platform } from '@/lib/social/types';
import type { ContentTemplate } from '@/lib/ai/types';
import type {
  ContentSuggestion,
  ContentSuggestionRequest,
  FillMyWeekRequest,
  FillMyWeekSlot,
  FillMyWeekResult,
} from './types';

// Seasonal events for awareness-based suggestions
const SEASONAL_EVENTS: Array<{
  name: string;
  month: number;
  day: number;
  category: string;
}> = [
  { name: "New Year's Day", month: 1, day: 1, category: 'holiday' },
  { name: "Valentine's Day", month: 2, day: 14, category: 'holiday' },
  { name: 'International Women\'s Day', month: 3, day: 8, category: 'awareness' },
  { name: 'Earth Day', month: 4, day: 22, category: 'awareness' },
  { name: 'Mother\'s Day', month: 5, day: 11, category: 'holiday' },
  { name: 'Father\'s Day', month: 6, day: 15, category: 'holiday' },
  { name: 'Independence Day', month: 7, day: 4, category: 'holiday' },
  { name: 'Labor Day', month: 9, day: 1, category: 'holiday' },
  { name: 'Halloween', month: 10, day: 31, category: 'holiday' },
  { name: 'Black Friday', month: 11, day: 28, category: 'shopping' },
  { name: 'Cyber Monday', month: 12, day: 1, category: 'shopping' },
  { name: 'Christmas', month: 12, day: 25, category: 'holiday' },
  { name: 'Mental Health Awareness Month', month: 5, day: 1, category: 'awareness' },
  { name: 'Small Business Saturday', month: 11, day: 29, category: 'business' },
];

const CONTENT_TEMPLATES: ContentTemplate[] = [
  'educational',
  'promotional',
  'storytelling',
  'engagement',
  'announcement',
  'behind-the-scenes',
];

/**
 * Analyzes the user's top-performing content to identify winning patterns.
 */
export async function analyzeWinningPatterns(
  userId: string,
  businessId: string,
  limit = 50
): Promise<Array<{ contentType: string; template: string; avgEngagement: number; count: number }>> {
  const topPosts = await prisma.postSchedule.findMany({
    where: {
      post: { userId, businessId },
      status: 'posted',
      postedAt: { not: null },
    },
    include: {
      post: { select: { contentType: true, contentText: true } },
      analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
    },
    orderBy: { postedAt: 'desc' },
    take: limit,
  });

  const patterns: Record<string, { totalEngagement: number; count: number }> = {};

  for (const schedule of topPosts) {
    if (!schedule.analytics[0]) continue;
    const a = schedule.analytics[0];
    const engagementScore =
      a.likes * 1 + a.comments * 3 + a.shares * 5 + a.saves * 4 + a.clicks * 2;
    const normalized = a.reach > 0 ? engagementScore / a.reach : engagementScore;

    const key = schedule.post.contentType;
    if (!patterns[key]) patterns[key] = { totalEngagement: 0, count: 0 };
    patterns[key].totalEngagement += normalized;
    patterns[key].count += 1;
  }

  return Object.entries(patterns)
    .map(([contentType, data]) => ({
      contentType,
      template: contentType,
      avgEngagement: data.count > 0 ? data.totalEngagement / data.count : 0,
      count: data.count,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);
}

/**
 * Gets upcoming seasonal events within the next N days.
 */
export function getUpcomingSeasonalEvents(daysAhead = 14): typeof SEASONAL_EVENTS {
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return SEASONAL_EVENTS.filter((event) => {
    const eventDate = new Date(now.getFullYear(), event.month - 1, event.day);
    if (eventDate < now) {
      eventDate.setFullYear(eventDate.getFullYear() + 1);
    }
    return eventDate >= now && eventDate <= cutoff;
  });
}

/**
 * Generates content suggestions based on performance data, trends, competitors, and seasonal events.
 */
export async function generateContentSuggestions(
  request: ContentSuggestionRequest
): Promise<ContentSuggestion[]> {
  const { userId, businessId, count = 5, includeCompetitorInspired = true, includeSeasonal = true } = request;

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business || business.userId !== userId) return [];

  const suggestions: ContentSuggestion[] = [];

  // 1. Performance-based suggestions from winning patterns
  const winningPatterns = await analyzeWinningPatterns(userId, businessId);
  if (winningPatterns.length > 0) {
    const topPattern = winningPatterns[0];
    suggestions.push({
      title: `Double down on ${topPattern.contentType} content`,
      description: `Your ${topPattern.contentType} posts have the highest engagement. Create more content in this format to maximize reach.`,
      contentType: topPattern.contentType as ContentSuggestion['contentType'],
      template: 'engagement',
      platforms: request.platforms || ['instagram', 'facebook'],
      hashtags: [],
      confidence: Math.min(0.9, 0.5 + topPattern.count * 0.05),
      source: 'performance',
    });
  }

  // 2. Gap-based suggestions (content types the user hasn't tried)
  const userContentTypes = new Set(winningPatterns.map((p) => p.contentType));
  const allTypes: ContentSuggestion['contentType'][] = ['text', 'image', 'video', 'carousel'];
  for (const type of allTypes) {
    if (!userContentTypes.has(type) && suggestions.length < count) {
      suggestions.push({
        title: `Try ${type} content`,
        description: `You haven't posted ${type} content yet. Diversifying your content mix can attract new audience segments.`,
        contentType: type,
        template: 'educational',
        platforms: request.platforms || ['instagram'],
        hashtags: [],
        confidence: 0.6,
        source: 'gap',
      });
    }
  }

  // 3. Seasonal suggestions
  if (includeSeasonal) {
    const upcoming = getUpcomingSeasonalEvents();
    for (const event of upcoming.slice(0, 2)) {
      if (suggestions.length >= count) break;
      suggestions.push({
        title: `${event.name} content`,
        description: `${event.name} is coming up! Create themed content to stay relevant and boost engagement.`,
        contentType: 'image',
        template: event.category === 'shopping' ? 'promotional' : 'engagement',
        platforms: request.platforms || ['instagram', 'facebook', 'twitter'],
        hashtags: [event.name.replace(/['\s]/g, ''), event.category],
        confidence: 0.75,
        source: 'seasonal',
      });
    }
  }

  // 4. Competitor-inspired suggestions
  if (includeCompetitorInspired) {
    const competitorPosts = await prisma.competitorPost.findMany({
      where: {
        competitorAccount: { competitor: { businessId } },
        isViral: true,
        postedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      include: { competitorAccount: { include: { competitor: true } } },
      orderBy: { engagementRate: 'desc' },
      take: 3,
    });

    for (const post of competitorPosts) {
      if (suggestions.length >= count) break;
      suggestions.push({
        title: `Trending in your niche: ${post.contentType} content`,
        description: `${post.competitorAccount.competitor.name} had a viral ${post.contentType} post. Adapt this format with your unique perspective.`,
        contentType: post.contentType as ContentSuggestion['contentType'],
        template: 'storytelling',
        platforms: [post.competitorAccount.platform as Platform],
        hashtags: (post.hashtags as string[]).slice(0, 5),
        confidence: 0.7,
        source: 'competitor',
      });
    }
  }

  // 5. AI-enhanced suggestions using trending topics
  if (suggestions.length < count) {
    const trends = await prisma.viralTrend.findMany({
      where: {
        expiresAt: { gt: new Date() },
        platform: { in: (request.platforms || ['instagram']) as string[] },
      },
      orderBy: { viralScore: 'desc' },
      take: 3,
    });

    for (const trend of trends) {
      if (suggestions.length >= count) break;
      suggestions.push({
        title: `Trending: ${trend.title}`,
        description: trend.description || `Jump on the "${trend.title}" trend before it peaks.`,
        contentType: 'video',
        template: 'engagement',
        platforms: [trend.platform as Platform],
        hashtags: [trend.title.replace(/\s+/g, '')],
        confidence: 0.65,
        source: 'trending',
      });
    }
  }

  return suggestions.slice(0, count);
}

/**
 * Generates a full week of diverse content suggestions with optimal posting times.
 */
export async function fillMyWeek(request: FillMyWeekRequest): Promise<FillMyWeekResult> {
  const { userId, businessId, socialAccountIds, timezone, postsPerDay = 2 } = request;

  // Determine week start (next Monday or provided start date)
  const startDate = request.startDate || getNextMonday();
  const weekStart = new Date(startDate);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  // Get social accounts with platforms
  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: socialAccountIds }, userId, isActive: true },
  });

  if (accounts.length === 0) return {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    slots: [],
    totalSuggestions: 0,
  };

  // Generate base suggestions
  const platforms = Array.from(new Set(accounts.map((a) => a.platform as Platform)));
  const suggestions = await generateContentSuggestions({
    userId,
    businessId,
    platforms,
    count: postsPerDay * 7,
    includeCompetitorInspired: true,
    includeSeasonal: true,
  });

  const slots: FillMyWeekSlot[] = [];
  let suggestionIndex = 0;

  // Distribute templates across the week for variety
  const weeklyTemplates: ContentTemplate[] = [
    'educational', 'engagement', 'storytelling',
    'behind-the-scenes', 'promotional', 'educational', 'engagement',
  ];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayOffset);
    const dayOfWeek = date.getUTCDay();

    for (let postNum = 0; postNum < postsPerDay; postNum++) {
      // Round-robin across accounts
      const account = accounts[postNum % accounts.length];
      const platform = account.platform as Platform;

      // Get optimal posting time for this slot
      const optimalSlots = await smartScheduler.getOptimalSlots({
        userId,
        socialAccountId: account.id,
        platform,
        timezone,
        preferredDate: date,
        count: postsPerDay,
        excludeSlots: slots
          .filter((s) => s.socialAccountId === account.id)
          .map((s) => s.scheduledAt),
      });

      const optimalTime = optimalSlots[postNum] || optimalSlots[0];
      const scheduledAt = optimalTime?.scheduledAt || date;

      // Use existing suggestion or create a template-based one
      const suggestion = suggestions[suggestionIndex] || {
        title: `${weeklyTemplates[dayOffset]} post`,
        description: `Create ${weeklyTemplates[dayOffset]} content for ${platform}`,
        contentType: 'text' as const,
        template: weeklyTemplates[dayOffset],
        platforms: [platform],
        hashtags: [],
        confidence: 0.5,
        source: 'gap' as const,
      };
      suggestionIndex++;

      slots.push({
        dayOfWeek,
        date: date.toISOString().slice(0, 10),
        scheduledAt,
        platform,
        socialAccountId: account.id,
        suggestion: { ...suggestion, optimalPostTime: scheduledAt },
      });
    }
  }

  return {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    slots,
    totalSuggestions: slots.length,
  };
}

function getNextMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + daysUntilMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}
