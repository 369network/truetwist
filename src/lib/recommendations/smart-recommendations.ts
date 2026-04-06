import { prisma } from '@/lib/prisma';
import type { Platform } from '@/lib/social/types';
import type {
  BestTimeRecommendation,
  PostingFrequencyRecommendation,
  ContentMixRecommendation,
  HashtagStrategyRecommendation,
  GrowthTacticRecommendation,
  AccountStage,
} from './types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Recommended posting frequencies by platform (posts per week)
const RECOMMENDED_FREQUENCIES: Record<Platform, { min: number; optimal: number; max: number }> = {
  instagram: { min: 3, optimal: 5, max: 7 },
  tiktok: { min: 3, optimal: 5, max: 7 },
  twitter: { min: 7, optimal: 14, max: 35 },
  facebook: { min: 3, optimal: 5, max: 7 },
  linkedin: { min: 2, optimal: 3, max: 5 },
  youtube: { min: 1, optimal: 2, max: 3 },
  pinterest: { min: 5, optimal: 15, max: 25 },
  threads: { min: 3, optimal: 7, max: 14 },
};

// Ideal content mix by platform
const IDEAL_CONTENT_MIX: Record<Platform, Record<string, number>> = {
  instagram: { image: 40, video: 30, carousel: 20, text: 10 },
  tiktok: { video: 90, image: 5, text: 5, carousel: 0 },
  twitter: { text: 50, image: 30, video: 15, carousel: 5 },
  facebook: { video: 35, image: 30, text: 20, carousel: 15 },
  linkedin: { text: 35, image: 25, video: 20, carousel: 20 },
  youtube: { video: 95, image: 3, text: 2, carousel: 0 },
  pinterest: { image: 70, video: 20, carousel: 10, text: 0 },
  threads: { text: 50, image: 30, video: 15, carousel: 5 },
};

/**
 * Recommends best times to post based on historical engagement data per platform/account.
 */
export async function getBestTimeRecommendations(
  userId: string,
  socialAccountId: string,
  platform: Platform
): Promise<BestTimeRecommendation> {
  // Fetch data-driven optimal times
  const storedTimes = await prisma.optimalPostingTime.findMany({
    where: { socialAccountId, platform },
    orderBy: { score: 'desc' },
    take: 15,
  });

  const hasData = storedTimes.length >= 5;
  const totalSamples = storedTimes.reduce((s, t) => s + t.sampleSize, 0);

  let dataQuality: 'high' | 'medium' | 'low';
  if (totalSamples >= 100) dataQuality = 'high';
  else if (totalSamples >= 20) dataQuality = 'medium';
  else dataQuality = 'low';

  const slots = storedTimes.map((t) => ({
    dayOfWeek: t.dayOfWeek,
    hourUtc: t.hourUtc,
    score: t.score,
    label: `${DAY_NAMES[t.dayOfWeek]} ${formatHour(t.hourUtc)} UTC`,
  }));

  return {
    platform,
    socialAccountId,
    slots,
    dataQuality: hasData ? dataQuality : 'low',
  };
}

/**
 * Recommends optimal posting frequency based on current activity and competitor data.
 */
export async function getPostingFrequencyRecommendation(
  userId: string,
  businessId: string,
  platform: Platform,
  socialAccountId: string
): Promise<PostingFrequencyRecommendation> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Current user frequency
  const userPostCount = await prisma.postSchedule.count({
    where: {
      socialAccountId,
      platform,
      status: 'posted',
      postedAt: { gte: thirtyDaysAgo },
    },
  });
  const currentFrequency = (userPostCount / 30) * 7;

  // Competitor average frequency
  const competitorAccounts = await prisma.competitorAccount.findMany({
    where: { competitor: { businessId }, platform },
    select: { postingFrequency: true },
  });
  const competitorAvgFrequency = competitorAccounts.length > 0
    ? competitorAccounts.reduce((s, a) => s + a.postingFrequency, 0) / competitorAccounts.length
    : 0;

  const recommended = RECOMMENDED_FREQUENCIES[platform];
  let recommendedFrequency = recommended.optimal;
  let reasoning: string;

  if (currentFrequency < recommended.min) {
    recommendedFrequency = recommended.min;
    reasoning = `You're posting ${currentFrequency.toFixed(1)}x/week on ${platform}, below the recommended minimum of ${recommended.min}. Increasing frequency will improve visibility and algorithm favor.`;
  } else if (currentFrequency > recommended.max) {
    recommendedFrequency = recommended.optimal;
    reasoning = `You're posting ${currentFrequency.toFixed(1)}x/week on ${platform}, above the recommended max of ${recommended.max}. This may cause audience fatigue. Focus on quality over quantity.`;
  } else if (competitorAvgFrequency > currentFrequency * 1.3) {
    recommendedFrequency = Math.min(
      Math.ceil(competitorAvgFrequency),
      recommended.max
    );
    reasoning = `Competitors post ${competitorAvgFrequency.toFixed(1)}x/week on ${platform} vs your ${currentFrequency.toFixed(1)}. Consider increasing frequency to stay competitive.`;
  } else {
    reasoning = `Your posting frequency of ${currentFrequency.toFixed(1)}x/week on ${platform} is within the healthy range. Maintain this pace for consistent growth.`;
  }

  return {
    platform,
    currentFrequency: Math.round(currentFrequency * 10) / 10,
    recommendedFrequency,
    competitorAvgFrequency: Math.round(competitorAvgFrequency * 10) / 10,
    reasoning,
  };
}

/**
 * Recommends ideal content mix (images/videos/text/carousels) based on platform best practices.
 */
export async function getContentMixRecommendation(
  userId: string,
  businessId: string,
  platform: Platform
): Promise<ContentMixRecommendation> {
  // Get user's current content mix
  const userPosts = await prisma.post.findMany({
    where: { userId, businessId },
    select: { contentType: true },
  });

  const currentMix: Record<string, number> = {};
  const total = userPosts.length || 1;
  for (const post of userPosts) {
    currentMix[post.contentType] = (currentMix[post.contentType] || 0) + 1;
  }
  // Convert counts to percentages
  for (const key of Object.keys(currentMix)) {
    currentMix[key] = Math.round((currentMix[key] / total) * 100);
  }

  // Get competitor average mix
  const competitorAccounts = await prisma.competitorAccount.findMany({
    where: { competitor: { businessId }, platform },
    select: { contentMix: true },
  });

  const competitorAvgMix: Record<string, number> = {};
  if (competitorAccounts.length > 0) {
    for (const account of competitorAccounts) {
      const mix = account.contentMix as Record<string, number>;
      for (const [type, pct] of Object.entries(mix)) {
        competitorAvgMix[type] = (competitorAvgMix[type] || 0) + pct;
      }
    }
    for (const key of Object.keys(competitorAvgMix)) {
      competitorAvgMix[key] = Math.round(competitorAvgMix[key] / competitorAccounts.length);
    }
  }

  const recommendedMix = IDEAL_CONTENT_MIX[platform] || {};

  const gaps = Object.entries(recommendedMix)
    .filter(([type, recommended]) => {
      const current = currentMix[type] || 0;
      return Math.abs(recommended - current) > 10;
    })
    .map(([type, recommended]) => {
      const current = currentMix[type] || 0;
      const diff = recommended - current;
      return {
        contentType: type,
        currentPercent: current,
        recommendedPercent: recommended,
        reason: diff > 0
          ? `Increase ${type} content by ~${diff}% to match platform best practices`
          : `Consider reducing ${type} content by ~${Math.abs(diff)}% and diversifying`,
      };
    })
    .sort((a, b) => Math.abs(b.recommendedPercent - b.currentPercent) - Math.abs(a.recommendedPercent - a.currentPercent));

  return { currentMix, recommendedMix, competitorAvgMix, gaps };
}

/**
 * Recommends hashtag strategy: consistent hashtags, rotating groups, and trending tags.
 */
export async function getHashtagStrategyRecommendation(
  userId: string,
  businessId: string,
  platform: Platform
): Promise<HashtagStrategyRecommendation> {
  // Analyze user's past hashtag performance
  const recentPosts = await prisma.postSchedule.findMany({
    where: {
      post: { userId, businessId },
      platform,
      status: 'posted',
    },
    include: {
      post: { select: { contentText: true } },
      analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
    },
    orderBy: { postedAt: 'desc' },
    take: 50,
  });

  // Extract hashtags and correlate with engagement
  const hashtagPerformance: Record<string, { totalEngagement: number; count: number }> = {};
  for (const schedule of recentPosts) {
    const text = schedule.post.contentText || '';
    const hashtags = text.match(/#\w+/g)?.map((h) => h.slice(1).toLowerCase()) || [];
    const engagement = schedule.analytics[0]
      ? schedule.analytics[0].likes + schedule.analytics[0].comments * 3 + schedule.analytics[0].shares * 5
      : 0;

    for (const tag of hashtags) {
      if (!hashtagPerformance[tag]) hashtagPerformance[tag] = { totalEngagement: 0, count: 0 };
      hashtagPerformance[tag].totalEngagement += engagement;
      hashtagPerformance[tag].count += 1;
    }
  }

  // Sort hashtags by average engagement
  const sorted = Object.entries(hashtagPerformance)
    .map(([tag, data]) => ({
      tag,
      avgEngagement: data.count > 0 ? data.totalEngagement / data.count : 0,
      count: data.count,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // Top consistent performers (used 3+ times with high engagement)
  const consistentHashtags = sorted
    .filter((h) => h.count >= 3)
    .slice(0, 5)
    .map((h) => h.tag);

  // Group remaining good hashtags into rotation groups of 5
  const rotatingPool = sorted
    .filter((h) => h.count >= 2 && !consistentHashtags.includes(h.tag))
    .slice(0, 15)
    .map((h) => h.tag);

  const rotatingHashtags: string[][] = [];
  for (let i = 0; i < rotatingPool.length; i += 5) {
    rotatingHashtags.push(rotatingPool.slice(i, i + 5));
  }

  // Get trending hashtags from competitor data
  const competitorAccounts = await prisma.competitorAccount.findMany({
    where: { competitor: { businessId }, platform },
    select: { topHashtags: true },
  });

  const trendingSet = new Set<string>();
  for (const account of competitorAccounts) {
    const tags = account.topHashtags as string[];
    tags.slice(0, 5).forEach((t) => trendingSet.add(t));
  }
  const trendingHashtags = Array.from(trendingSet).slice(0, 10);

  // Low-performing hashtags to avoid
  const avoidHashtags = sorted
    .filter((h) => h.count >= 3 && h.avgEngagement < sorted[0]?.avgEngagement * 0.1)
    .slice(0, 5)
    .map((h) => h.tag);

  const optimalCountByPlatform: Record<string, number> = {
    instagram: 15,
    tiktok: 5,
    twitter: 3,
    facebook: 5,
    linkedin: 5,
    youtube: 10,
    pinterest: 10,
    threads: 5,
  };

  return {
    consistentHashtags,
    rotatingHashtags,
    trendingHashtags,
    avoidHashtags,
    optimalCount: optimalCountByPlatform[platform] || 5,
    platform,
  };
}

/**
 * Determines the account stage based on follower count and account age.
 */
export function determineAccountStage(followerCount: number, accountAgeDays: number): AccountStage {
  if (followerCount < 1000 || accountAgeDays < 90) return 'new';
  if (followerCount < 10000) return 'growing';
  return 'established';
}

/**
 * Recommends growth tactics based on account stage (new, growing, established).
 */
export async function getGrowthTacticRecommendations(
  userId: string,
  socialAccountId: string,
  platform: Platform
): Promise<GrowthTacticRecommendation> {
  const account = await prisma.socialAccount.findFirst({
    where: { id: socialAccountId, userId },
  });

  const followerCount = account?.followerCount || 0;
  const connectedAt = account?.connectedAt || new Date();
  const accountAgeDays = Math.floor(
    (Date.now() - connectedAt.getTime()) / (24 * 60 * 60 * 1000)
  );
  const accountStage = determineAccountStage(followerCount, accountAgeDays);

  const tactics = GROWTH_TACTICS[accountStage][platform] || GROWTH_TACTICS[accountStage].instagram;

  return { accountStage, tactics, platform };
}

const GROWTH_TACTICS: Record<AccountStage, Record<string, GrowthTacticRecommendation['tactics']>> = {
  new: {
    instagram: [
      { title: 'Post consistently', description: 'Establish a regular posting schedule of 3-5 times per week to build momentum with the algorithm.', priority: 'high', category: 'consistency', estimatedImpact: '50-100% reach increase in first month' },
      { title: 'Use Reels strategically', description: 'Post 2-3 Reels per week. Instagram heavily promotes Reels to new audiences, making them your best discovery tool.', priority: 'high', category: 'content', estimatedImpact: '3-5x more discovery vs static posts' },
      { title: 'Engage with your niche', description: 'Spend 15 minutes daily commenting meaningfully on posts from accounts in your niche. Avoid generic comments.', priority: 'high', category: 'engagement', estimatedImpact: '20-30 new followers per week' },
      { title: 'Optimize your bio', description: 'Include a clear value proposition, relevant keywords, and a call-to-action in your bio.', priority: 'medium', category: 'optimization', estimatedImpact: '2-3x profile visit to follow conversion' },
      { title: 'Use all hashtag slots', description: 'Use 15-20 hashtags mixing niche (10K-100K posts), medium (100K-500K), and popular (500K+) tags.', priority: 'medium', category: 'optimization', estimatedImpact: '30-50% more impressions from hashtags' },
    ],
    tiktok: [
      { title: 'Post 1-3 times daily', description: 'TikTok rewards high-frequency posting. Each video gets a chance on the For You Page regardless of follower count.', priority: 'high', category: 'consistency', estimatedImpact: '3x faster growth vs weekly posting' },
      { title: 'Hook viewers in 1 second', description: 'The first second determines if viewers stay. Start with a bold statement, question, or visual hook.', priority: 'high', category: 'content', estimatedImpact: '2-3x higher watch time' },
      { title: 'Jump on trending sounds', description: 'Use trending sounds within 24-48 hours of emergence. Early adopters get algorithmic boost.', priority: 'high', category: 'content', estimatedImpact: '5-10x more views per trending video' },
      { title: 'Reply to comments with videos', description: 'Create video replies to interesting comments. These get pushed to the original viewer\'s followers too.', priority: 'medium', category: 'engagement', estimatedImpact: '1.5x engagement rate boost' },
    ],
    twitter: [
      { title: 'Tweet 3-5 times daily', description: 'Twitter rewards active accounts. Mix threads, opinions, and engagement tweets.', priority: 'high', category: 'consistency', estimatedImpact: '2x impressions within 2 weeks' },
      { title: 'Write threads', description: 'Long-form threads get 2-5x more engagement than single tweets. Share expertise in thread format.', priority: 'high', category: 'content', estimatedImpact: '3-5x more profile visits' },
      { title: 'Quote tweet thought leaders', description: 'Add your unique take when quote-tweeting popular accounts in your niche.', priority: 'medium', category: 'engagement', estimatedImpact: '50-100 new followers per viral quote' },
    ],
    facebook: [
      { title: 'Focus on video content', description: 'Facebook prioritizes video in the algorithm. Post at least 2 videos per week.', priority: 'high', category: 'content', estimatedImpact: '2-3x more organic reach' },
      { title: 'Join and contribute to Groups', description: 'Participate in relevant Facebook Groups to build authority and drive traffic to your page.', priority: 'high', category: 'engagement', estimatedImpact: '30-50 new followers per active group' },
      { title: 'Use Facebook Stories', description: 'Stories appear at the top of the feed. Post 3-5 stories daily for maximum visibility.', priority: 'medium', category: 'content', estimatedImpact: '20-30% more page visits' },
    ],
    linkedin: [
      { title: 'Post 3-5 times per week', description: 'LinkedIn\'s algorithm favors consistent posters. Share industry insights and professional experiences.', priority: 'high', category: 'consistency', estimatedImpact: '5x more profile views' },
      { title: 'Write long-form posts', description: 'Posts with 1,200-1,500 characters get 2x more engagement. Tell stories from your professional journey.', priority: 'high', category: 'content', estimatedImpact: '2x engagement rate' },
      { title: 'Comment on industry leaders\' posts', description: 'Leave thoughtful comments on posts from prominent people in your field.', priority: 'medium', category: 'engagement', estimatedImpact: '10-20 new connections per week' },
    ],
    youtube: [
      { title: 'Upload weekly', description: 'Consistency is key on YouTube. One quality video per week outperforms sporadic uploads.', priority: 'high', category: 'consistency', estimatedImpact: 'Algorithmic boost after 12+ consistent weeks' },
      { title: 'Optimize titles and thumbnails', description: 'Spend 30% of production time on thumbnails and titles. They determine click-through rate.', priority: 'high', category: 'optimization', estimatedImpact: '2-5x more clicks from search/suggested' },
      { title: 'Use YouTube Shorts', description: 'Post 2-3 Shorts per week. They reach non-subscribers and drive channel discovery.', priority: 'high', category: 'content', estimatedImpact: '10x subscriber growth acceleration' },
    ],
    pinterest: [
      { title: 'Pin 5-15 times daily', description: 'Pinterest rewards high-volume, consistent pinning. Use a scheduling tool to spread pins throughout the day.', priority: 'high', category: 'consistency', estimatedImpact: '3x more impressions within 30 days' },
      { title: 'Create rich pins', description: 'Enable rich pins for your content. They include extra information and get higher engagement.', priority: 'medium', category: 'optimization', estimatedImpact: '20-30% higher click-through rate' },
    ],
    threads: [
      { title: 'Post daily', description: 'Threads is still growing. Early consistent presence builds a loyal following.', priority: 'high', category: 'consistency', estimatedImpact: 'First-mover advantage in niche' },
      { title: 'Cross-promote from Instagram', description: 'Share your Threads posts on Instagram Stories to bring your existing audience over.', priority: 'medium', category: 'engagement', estimatedImpact: '5-10% Instagram follower migration' },
    ],
  },
  growing: {
    instagram: [
      { title: 'Collaborate with similar-sized accounts', description: 'Partner for joint Lives, Reels, or content swaps with accounts in your follower range.', priority: 'high', category: 'collaboration', estimatedImpact: '100-500 new followers per collab' },
      { title: 'Create saveable content', description: 'Educational carousels and infographics drive saves, which boost algorithmic ranking significantly.', priority: 'high', category: 'content', estimatedImpact: '2x algorithmic reach' },
      { title: 'Analyze and double down', description: 'Review your top 10 posts monthly. Identify patterns and create more content like your winners.', priority: 'medium', category: 'optimization', estimatedImpact: '30-50% engagement improvement' },
      { title: 'Engage within the first hour', description: 'Reply to every comment within 60 minutes of posting. Early engagement signals boost distribution.', priority: 'medium', category: 'engagement', estimatedImpact: '1.5x post reach' },
    ],
    tiktok: [
      { title: 'Create series content', description: 'Multi-part content builds anticipation and follow incentive. Use "Part 1/3" format.', priority: 'high', category: 'content', estimatedImpact: '2x follow rate on series videos' },
      { title: 'Duet and Stitch viral content', description: 'Piggyback on viral videos with your unique perspective using Duet and Stitch features.', priority: 'high', category: 'content', estimatedImpact: '5x views on trending piggybacks' },
      { title: 'Go live weekly', description: 'TikTok LIVE pushes your profile to followers and suggested. Build real-time community.', priority: 'medium', category: 'engagement', estimatedImpact: '2x profile visits during live sessions' },
    ],
    twitter: [
      { title: 'Build a content flywheel', description: 'Repurpose your best threads into standalone tweets, images, and follow-up threads.', priority: 'high', category: 'content', estimatedImpact: '3x content output without extra effort' },
      { title: 'Host Twitter Spaces', description: 'Host weekly audio conversations on niche topics. Invite guest speakers for wider reach.', priority: 'medium', category: 'collaboration', estimatedImpact: '50-200 new followers per Space' },
    ],
    facebook: [
      { title: 'Start a Facebook Group', description: 'Create a branded community group. Groups get 5x more organic reach than pages.', priority: 'high', category: 'engagement', estimatedImpact: '5x organic reach vs page posts' },
      { title: 'Use Facebook Live', description: 'Live videos get 6x more engagement than regular videos. Go live at least weekly.', priority: 'high', category: 'content', estimatedImpact: '6x engagement rate' },
    ],
    linkedin: [
      { title: 'Publish LinkedIn articles', description: 'Long-form articles establish thought leadership and rank in LinkedIn search.', priority: 'high', category: 'content', estimatedImpact: '3x profile visits from articles' },
      { title: 'Start newsletter on LinkedIn', description: 'LinkedIn newsletters get push notifications to subscribers. Massive distribution advantage.', priority: 'high', category: 'content', estimatedImpact: '10x reach vs regular posts' },
    ],
    youtube: [
      { title: 'Optimize for suggested videos', description: 'Create content that complements popular videos in your niche. Match title patterns and thumbnail styles.', priority: 'high', category: 'optimization', estimatedImpact: '50% of views from suggested' },
      { title: 'Build playlist funnels', description: 'Organize videos into playlists that guide viewers from introductory to advanced content.', priority: 'medium', category: 'optimization', estimatedImpact: '30% increase in session time' },
    ],
    pinterest: [
      { title: 'Create idea pins', description: 'Idea Pins (multi-page) get 9x more engagement than standard pins.', priority: 'high', category: 'content', estimatedImpact: '9x engagement rate' },
    ],
    threads: [
      { title: 'Start conversations', description: 'Ask thought-provoking questions. Threads rewards conversation starters with distribution.', priority: 'high', category: 'engagement', estimatedImpact: '3x reply rate drives algorithmic boost' },
    ],
  },
  established: {
    instagram: [
      { title: 'Launch product collaborations', description: 'Partner with brands or creators for co-branded content and cross-promotion at scale.', priority: 'high', category: 'collaboration', estimatedImpact: '1,000-5,000 new followers per partnership' },
      { title: 'Diversify content pillars', description: 'Establish 3-4 distinct content themes. Rotate between them to maintain audience interest.', priority: 'medium', category: 'content', estimatedImpact: '20% reduction in unfollow rate' },
      { title: 'Test paid promotion on top content', description: 'Boost your best-performing organic posts to reach new audiences efficiently.', priority: 'medium', category: 'optimization', estimatedImpact: '$0.01-0.05 per new follower on boosted posts' },
    ],
    tiktok: [
      { title: 'Launch branded challenges', description: 'Create a branded hashtag challenge. These can go viral and generate massive UGC.', priority: 'high', category: 'content', estimatedImpact: '10x brand awareness in target demo' },
      { title: 'Experiment with longer content', description: 'Test 3-10 minute videos. TikTok is pushing longer content and rewarding watch time.', priority: 'medium', category: 'content', estimatedImpact: '2x revenue potential from longer watch sessions' },
    ],
    twitter: [
      { title: 'Monetize with premium content', description: 'Offer exclusive threads, early access, or deep dives through subscriptions.', priority: 'high', category: 'content', estimatedImpact: '1-5% subscriber conversion' },
    ],
    facebook: [
      { title: 'Invest in community management', description: 'Dedicate resources to managing your Group. Active groups drive the most loyal customers.', priority: 'high', category: 'engagement', estimatedImpact: '3x customer lifetime value from group members' },
    ],
    linkedin: [
      { title: 'Position as industry voice', description: 'Comment on industry news within hours. First movers in trending conversations get massive distribution.', priority: 'high', category: 'engagement', estimatedImpact: '10x impression spikes on timely posts' },
    ],
    youtube: [
      { title: 'Diversify revenue streams', description: 'Combine AdSense with memberships, super chats, and sponsored content for sustainable income.', priority: 'high', category: 'optimization', estimatedImpact: '2-3x revenue per 1,000 views' },
    ],
    pinterest: [
      { title: 'Build shopping integrations', description: 'Enable product pins that link directly to your store. Pinterest users have high purchase intent.', priority: 'high', category: 'optimization', estimatedImpact: '2x click-to-purchase conversion vs other platforms' },
    ],
    threads: [
      { title: 'Build community rituals', description: 'Create recurring content themes (e.g., "Monday Motivation") that followers anticipate.', priority: 'medium', category: 'engagement', estimatedImpact: '40% higher engagement on recurring series' },
    ],
  },
};

function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}
