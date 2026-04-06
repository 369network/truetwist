import { prisma } from '@/lib/prisma';

/**
 * User feedback signals on AI-generated content.
 * These signals feed back into the recommendation engine
 * to improve future content generation quality.
 */
export type FeedbackAction =
  | 'used'         // user published the generated content as-is
  | 'edited'       // user edited before publishing
  | 'discarded'    // user dismissed/deleted the generated content
  | 'favorited'    // user saved as favorite/template
  | 'regenerated'  // user requested regeneration (implicit negative signal)
  | 'shared';      // user shared generated content externally

export interface ContentFeedbackInput {
  userId: string;
  generationId: string;     // links to AiGeneration.id
  action: FeedbackAction;
  platform?: string;
  editDistance?: number;     // 0-1 ratio of how much was changed (for 'edited')
  postId?: string;          // if content was published, link to the post
  metadata?: Record<string, unknown>;
}

export interface FeedbackStats {
  totalGenerations: number;
  usedAsIs: number;
  edited: number;
  discarded: number;
  favorited: number;
  regenerated: number;
  useRate: number;       // (used + edited) / total
  editRate: number;      // edited / (used + edited)
  discardRate: number;   // discarded / total
}

// Signal weights for the recommendation feedback loop
const SIGNAL_WEIGHTS: Record<FeedbackAction, number> = {
  used: 1.0,
  edited: 0.5,
  favorited: 1.2,
  shared: 1.5,
  discarded: -0.5,
  regenerated: -0.3,
};

/**
 * Records a user's action on AI-generated content.
 * This data is used to improve future generation quality
 * by learning which prompts, tones, and templates produce
 * content that users actually publish.
 */
export async function recordFeedback(input: ContentFeedbackInput): Promise<void> {
  const weight = SIGNAL_WEIGHTS[input.action] ?? 0;

  await prisma.contentFeedback.create({
    data: {
      userId: input.userId,
      generationId: input.generationId,
      action: input.action,
      platform: input.platform,
      editDistance: input.editDistance,
      postId: input.postId,
      signalWeight: weight,
      metadata: input.metadata ?? {},
    },
  });
}

/**
 * Computes feedback statistics for a user over a given period.
 * Used to calibrate the recommendation engine.
 */
export async function getUserFeedbackStats(
  userId: string,
  daysBack: number = 30
): Promise<FeedbackStats> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const feedbacks = await prisma.contentFeedback.groupBy({
    by: ['action'],
    where: { userId, createdAt: { gte: since } },
    _count: { action: true },
  });

  const counts: Record<string, number> = {};
  let total = 0;
  for (const f of feedbacks) {
    counts[f.action] = f._count.action;
    total += f._count.action;
  }

  const used = counts['used'] ?? 0;
  const edited = counts['edited'] ?? 0;
  const discarded = counts['discarded'] ?? 0;
  const favorited = counts['favorited'] ?? 0;
  const regenerated = counts['regenerated'] ?? 0;

  return {
    totalGenerations: total,
    usedAsIs: used,
    edited,
    discarded,
    favorited,
    regenerated,
    useRate: total > 0 ? (used + edited) / total : 0,
    editRate: (used + edited) > 0 ? edited / (used + edited) : 0,
    discardRate: total > 0 ? discarded / total : 0,
  };
}

/**
 * Computes a preference profile from feedback data.
 * Returns the tones, templates, and platforms that
 * produce the highest-quality results for a user.
 */
export async function getUserPreferences(
  userId: string,
  daysBack: number = 90
): Promise<{
  preferredTones: string[];
  preferredTemplates: string[];
  bestPlatforms: string[];
  avgEditDistance: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  // Get positive-signal feedbacks with their generation data
  const feedbacks = await prisma.contentFeedback.findMany({
    where: {
      userId,
      createdAt: { gte: since },
      action: { in: ['used', 'favorited', 'shared'] },
    },
    include: {
      generation: {
        select: { prompt: true, modelUsed: true, generationType: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // Aggregate platform preferences
  const platformCounts: Record<string, number> = {};
  let totalEditDistance = 0;
  let editCount = 0;

  for (const fb of feedbacks) {
    if (fb.platform) {
      platformCounts[fb.platform] = (platformCounts[fb.platform] ?? 0) + 1;
    }
    if (fb.editDistance != null) {
      totalEditDistance += fb.editDistance;
      editCount++;
    }
  }

  const bestPlatforms = Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([p]) => p);

  return {
    preferredTones: [],      // populated when tone is tracked in generation metadata
    preferredTemplates: [],  // populated when template is tracked
    bestPlatforms,
    avgEditDistance: editCount > 0 ? totalEditDistance / editCount : 0,
  };
}

/**
 * Computes a weighted feedback score for a specific generation.
 * Higher scores indicate content the user found more useful.
 */
export async function getGenerationScore(generationId: string): Promise<number> {
  const feedbacks = await prisma.contentFeedback.findMany({
    where: { generationId },
    select: { signalWeight: true },
  });

  if (feedbacks.length === 0) return 0;

  return feedbacks.reduce((sum: number, f: { signalWeight: number }) => sum + f.signalWeight, 0) / feedbacks.length;
}
