import { Queue, Worker, type Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import type { CollectionJobData, CompetitorCollectionResult } from './types';

const QUEUE_NAME = 'competitor-collection';
const COLLECTION_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

function getConnection() {
  return {
    host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
    port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379'),
  };
}

let _competitorCollectionQueue: Queue<CollectionJobData> | undefined;
export const competitorCollectionQueue = new Proxy({} as Queue<CollectionJobData>, {
  get(_, prop) {
    if (!_competitorCollectionQueue) {
      _competitorCollectionQueue = new Queue<CollectionJobData>(QUEUE_NAME, {
        connection: getConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 60000 },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 1000 },
        },
      });
    }
    const val = (_competitorCollectionQueue as any)[prop];
    return typeof val === 'function' ? val.bind(_competitorCollectionQueue) : val;
  },
});

/**
 * Schedules collection jobs for all tracked competitor accounts.
 * Returns the number of jobs queued.
 */
export async function triggerCompetitorCollection(): Promise<number> {
  const accounts = await prisma.competitorAccount.findMany({
    include: { competitor: true },
  });

  let queued = 0;
  for (const account of accounts) {
    await competitorCollectionQueue.add('collect', {
      competitorAccountId: account.id,
      competitorId: account.competitorId,
      businessId: account.competitor.businessId,
      platform: account.platform,
      handle: account.handle,
    }, {
      jobId: `collect:${account.id}:${Date.now()}`,
    });
    queued++;
  }

  return queued;
}

/**
 * Processes a single competitor account collection job.
 * Fetches profile data and recent posts, stores them, and creates a historical snapshot.
 */
async function processCollectionJob(job: Job<CollectionJobData>): Promise<CompetitorCollectionResult> {
  const { competitorAccountId, businessId, platform, handle } = job.data;

  // Simulate fetching public profile data from the platform API
  // In production, this would use platform-specific API clients
  const profileData = await fetchCompetitorProfile(platform, handle);
  const recentPosts = await fetchCompetitorPosts(platform, handle);

  // Calculate derived metrics from posts
  const totalEngagement = recentPosts.reduce(
    (sum, p) => sum + p.likes + p.comments + p.shares + p.saves,
    0
  );
  const avgEngagementRate = profileData.followerCount > 0 && recentPosts.length > 0
    ? totalEngagement / recentPosts.length / profileData.followerCount
    : 0;
  const avgLikes = recentPosts.length > 0
    ? recentPosts.reduce((s, p) => s + p.likes, 0) / recentPosts.length
    : 0;
  const avgComments = recentPosts.length > 0
    ? recentPosts.reduce((s, p) => s + p.comments, 0) / recentPosts.length
    : 0;

  // Calculate posting frequency (posts per week)
  const postingFrequency = calculatePostingFrequency(recentPosts);

  // Determine content mix
  const contentMix = calculateContentMix(recentPosts);

  // Extract top hashtags
  const topHashtags = extractTopHashtags(recentPosts);

  // Calculate peak posting hours
  const peakPostingHours = calculatePeakPostingHours(recentPosts);

  // Get previous account state for change detection
  const previousAccount = await prisma.competitorAccount.findUnique({
    where: { id: competitorAccountId },
  });

  // Update the competitor account with latest data
  await prisma.competitorAccount.update({
    where: { id: competitorAccountId },
    data: {
      followerCount: profileData.followerCount,
      followingCount: profileData.followingCount,
      postCount: profileData.postCount,
      engagementRate: avgEngagementRate,
      avgLikes,
      avgComments,
      postingFrequency,
      topHashtags,
      contentMix,
      peakPostingHours,
      lastScrapedAt: new Date(),
    },
  });

  // Create historical snapshot
  await prisma.competitorAccountSnapshot.create({
    data: {
      competitorAccountId,
      followerCount: profileData.followerCount,
      followingCount: profileData.followingCount,
      postCount: profileData.postCount,
      engagementRate: avgEngagementRate,
      postingFrequency,
    },
  });

  // Upsert posts using prisma.upsert to eliminate N+1 find+create/update loop.
  // Batch viral alerts to reduce individual inserts.
  let newPosts = 0;
  let updatedPosts = 0;
  const viralAlerts: Array<{
    businessId: string;
    competitorId: string;
    competitorAccountId: string;
    alertType: string;
    title: string;
    description: string;
    severity: string;
    metadata: any;
  }> = [];

  // Fetch existing posts in one query to detect newly-viral posts
  const platformPostIds = recentPosts.map(p => p.platformPostId);
  const existingPosts = platformPostIds.length > 0
    ? await prisma.competitorPost.findMany({
        where: { platformPostId: { in: platformPostIds } },
        select: { platformPostId: true, isViral: true },
      })
    : [];
  const existingMap = new Map(existingPosts.map(p => [p.platformPostId, p]));

  for (const post of recentPosts) {
    const engagementRate = profileData.followerCount > 0
      ? (post.likes + post.comments + post.shares + post.saves) / profileData.followerCount
      : 0;
    const isViral = engagementRate > avgEngagementRate * 3;
    const existing = existingMap.get(post.platformPostId);

    await prisma.competitorPost.upsert({
      where: { platformPostId: post.platformPostId },
      update: {
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves,
        engagementRate,
        isViral,
        scrapedAt: new Date(),
      },
      create: {
        competitorAccountId,
        platformPostId: post.platformPostId,
        contentText: post.contentText,
        contentType: post.contentType,
        mediaUrls: post.mediaUrls,
        hashtags: post.hashtags,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves,
        engagementRate,
        isViral,
        postedAt: post.postedAt,
      },
    });

    if (existing) {
      updatedPosts++;
    } else {
      newPosts++;
    }

    // Collect viral alerts for batch insert
    if (isViral && !existing?.isViral) {
      viralAlerts.push({
        businessId,
        competitorId: job.data.competitorId,
        competitorAccountId,
        alertType: 'viral_post',
        title: `Viral post detected from ${handle}`,
        description: `A post from @${handle} on ${platform} is getting ${engagementRate > avgEngagementRate * 5 ? '5x+' : '3x+'} normal engagement (${post.likes} likes, ${post.comments} comments).`,
        severity: engagementRate > avgEngagementRate * 5 ? 'critical' : 'warning',
        metadata: {
          postId: post.platformPostId,
          engagementRate,
          normalRate: avgEngagementRate,
          likes: post.likes,
          comments: post.comments,
        } as any,
      });
    }
  }

  // Batch insert viral alerts
  if (viralAlerts.length > 0) {
    await prisma.competitorAlert.createMany({ data: viralAlerts });
  }

  // Detect strategy changes
  if (previousAccount) {
    await detectStrategyChanges(
      businessId,
      job.data.competitorId,
      competitorAccountId,
      handle,
      platform,
      previousAccount,
      { postingFrequency, contentMix, peakPostingHours, followerCount: profileData.followerCount }
    );
  }

  return {
    accountId: competitorAccountId,
    platform: platform as any,
    handle,
    followerCount: profileData.followerCount,
    followingCount: profileData.followingCount,
    postCount: profileData.postCount,
    newPosts,
    updatedPosts,
  };
}

/**
 * Detects significant changes in competitor strategy and creates alerts.
 */
async function detectStrategyChanges(
  businessId: string,
  competitorId: string,
  competitorAccountId: string,
  handle: string,
  platform: string,
  previous: { postingFrequency: number; contentMix: any; followerCount: number },
  current: { postingFrequency: number; contentMix: any; peakPostingHours: any; followerCount: number }
): Promise<void> {
  const alerts: Array<{
    alertType: string;
    title: string;
    description: string;
    severity: string;
    metadata: any;
  }> = [];

  // Posting frequency change > 50%
  if (previous.postingFrequency > 0) {
    const freqChange = (current.postingFrequency - previous.postingFrequency) / previous.postingFrequency;
    if (Math.abs(freqChange) > 0.5) {
      alerts.push({
        alertType: 'strategy_change',
        title: `@${handle} posting frequency ${freqChange > 0 ? 'increased' : 'decreased'} by ${Math.round(Math.abs(freqChange) * 100)}%`,
        description: `@${handle} on ${platform} changed posting frequency from ${previous.postingFrequency.toFixed(1)} to ${current.postingFrequency.toFixed(1)} posts/week.`,
        severity: 'warning',
        metadata: { previous: previous.postingFrequency, current: current.postingFrequency, changePercent: freqChange * 100 },
      });
    }
  }

  // Follower spike > 20% in one collection cycle
  if (previous.followerCount > 0) {
    const followerChange = (current.followerCount - previous.followerCount) / previous.followerCount;
    if (followerChange > 0.2) {
      alerts.push({
        alertType: 'follower_spike',
        title: `@${handle} gained ${Math.round(followerChange * 100)}% followers`,
        description: `@${handle} on ${platform} grew from ${previous.followerCount.toLocaleString()} to ${current.followerCount.toLocaleString()} followers.`,
        severity: followerChange > 0.5 ? 'critical' : 'warning',
        metadata: { previous: previous.followerCount, current: current.followerCount, changePercent: followerChange * 100 },
      });
    }
  }

  if (alerts.length > 0) {
    await prisma.competitorAlert.createMany({
      data: alerts.map(alert => ({
        businessId,
        competitorId,
        competitorAccountId,
        ...alert,
      })),
    });
  }
}

// --- Platform data fetching (simulated; in production use real API clients) ---

interface ProfileData {
  followerCount: number;
  followingCount: number;
  postCount: number;
}

interface PostData {
  platformPostId: string;
  contentText: string | null;
  contentType: string;
  mediaUrls: string[];
  hashtags: string[];
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  postedAt: Date;
}

/**
 * Fetches a competitor's public profile metrics.
 * In production, this calls platform-specific APIs (Twitter API, Instagram Graph API, etc.)
 */
export async function fetchCompetitorProfile(platform: string, handle: string): Promise<ProfileData> {
  // TODO: Implement real platform API calls
  // This is a placeholder that returns zeroes — real data comes from platform adapters
  return { followerCount: 0, followingCount: 0, postCount: 0 };
}

/**
 * Fetches a competitor's recent posts from the platform.
 * In production, this calls platform-specific APIs.
 */
export async function fetchCompetitorPosts(platform: string, handle: string): Promise<PostData[]> {
  // TODO: Implement real platform API calls
  return [];
}

// --- Derived metrics helpers ---

function calculatePostingFrequency(posts: PostData[]): number {
  if (posts.length < 2) return posts.length;
  const sorted = [...posts].sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());
  const spanMs = sorted[sorted.length - 1].postedAt.getTime() - sorted[0].postedAt.getTime();
  const spanWeeks = spanMs / (7 * 24 * 60 * 60 * 1000);
  return spanWeeks > 0 ? posts.length / spanWeeks : posts.length;
}

function calculateContentMix(posts: PostData[]): Record<string, number> {
  if (posts.length === 0) return {};
  const counts: Record<string, number> = {};
  for (const post of posts) {
    counts[post.contentType] = (counts[post.contentType] || 0) + 1;
  }
  const mix: Record<string, number> = {};
  for (const [type, count] of Object.entries(counts)) {
    mix[type] = Math.round((count / posts.length) * 100);
  }
  return mix;
}

function extractTopHashtags(posts: PostData[], limit = 20): string[] {
  const counts: Record<string, number> = {};
  for (const post of posts) {
    for (const tag of post.hashtags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function calculatePeakPostingHours(posts: PostData[]): number[] {
  const hourCounts: Record<number, number> = {};
  for (const post of posts) {
    const hour = post.postedAt.getUTCHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }
  return Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hour]) => parseInt(hour));
}

/**
 * Creates the BullMQ worker for competitor data collection.
 */
export function createCompetitorCollectionWorker() {
  return new Worker<CollectionJobData>(
    QUEUE_NAME,
    processCollectionJob,
    { connection: getConnection(), concurrency: 5 }
  );
}

/**
 * Starts the periodic collection scheduler (every 6 hours).
 */
export function startCollectionScheduler(): ReturnType<typeof setInterval> {
  // Run immediately on start
  triggerCompetitorCollection().catch(console.error);

  return setInterval(() => {
    triggerCompetitorCollection().catch(console.error);
  }, COLLECTION_INTERVAL_MS);
}
