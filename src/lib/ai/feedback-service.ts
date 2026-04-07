/**
 * Content Feedback Service
 *
 * Records user actions on AI-generated content (used, edited, discarded, etc.)
 * and computes recency-weighted generation scores to improve recommendations.
 */

import { prisma } from "@/lib/prisma";

export type FeedbackAction =
  | "used" // published as-is
  | "edited" // published with edits
  | "discarded" // generated but not used
  | "favorited" // saved for later
  | "regenerated" // asked for new variants
  | "shared"; // shared externally

// Signal weights: higher = stronger positive signal
const SIGNAL_WEIGHTS: Record<FeedbackAction, number> = {
  used: 1.0,
  edited: 0.6,
  favorited: 0.8,
  shared: 0.9,
  regenerated: -0.3,
  discarded: -0.5,
};

// Exponential decay half-life in days
const DECAY_HALF_LIFE_DAYS = 14;

export interface FeedbackInput {
  userId: string;
  generationId: string;
  action: FeedbackAction;
  metadata?: Record<string, unknown>;
}

export interface GenerationScore {
  score: number; // -1 to 1 weighted score
  totalFeedback: number;
  recentBias: number; // how much recency affected the score
}

export async function recordFeedback(input: FeedbackInput): Promise<void> {
  await prisma.contentFeedback.create({
    data: {
      userId: input.userId,
      generationId: input.generationId,
      action: input.action,
      metadata: (input.metadata ?? {}) as any, // Cast to Prisma.JsonValue
    },
  });
}

/**
 * Computes a recency-weighted score for a specific generation.
 * Uses exponential decay so newer feedback weighs more than stale signals.
 */
export async function getGenerationScore(
  generationId: string,
): Promise<GenerationScore> {
  const feedbacks = await prisma.contentFeedback.findMany({
    where: { generationId },
    orderBy: { createdAt: "desc" },
  });

  if (feedbacks.length === 0) {
    return { score: 0, totalFeedback: 0, recentBias: 0 };
  }

  const now = Date.now();
  let weightedSum = 0;
  let totalWeight = 0;

  for (const fb of feedbacks) {
    const ageDays = (now - fb.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.exp((-Math.LN2 * ageDays) / DECAY_HALF_LIFE_DAYS);
    const signal = SIGNAL_WEIGHTS[fb.action as FeedbackAction] ?? 0;

    weightedSum += signal * decayFactor;
    totalWeight += decayFactor;
  }

  const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const rawAvg =
    feedbacks.reduce(
      (sum, fb) => sum + (SIGNAL_WEIGHTS[fb.action as FeedbackAction] ?? 0),
      0,
    ) / feedbacks.length;
  const recentBias = Math.abs(score - rawAvg);

  return {
    score: Math.max(-1, Math.min(1, score)),
    totalFeedback: feedbacks.length,
    recentBias: Math.round(recentBias * 1000) / 1000,
  };
}

/**
 * Gets aggregate feedback stats for a user to inform content preferences.
 */
export async function getUserFeedbackProfile(userId: string): Promise<{
  totalGenerations: number;
  actionBreakdown: Record<string, number>;
  avgScore: number;
}> {
  const feedbacks = await prisma.contentFeedback.findMany({
    where: { userId },
    select: { action: true, createdAt: true },
  });

  const actionBreakdown: Record<string, number> = {};
  let scoreSum = 0;

  for (const fb of feedbacks) {
    actionBreakdown[fb.action] = (actionBreakdown[fb.action] || 0) + 1;
    scoreSum += SIGNAL_WEIGHTS[fb.action as FeedbackAction] ?? 0;
  }

  return {
    totalGenerations: feedbacks.length,
    actionBreakdown,
    avgScore: feedbacks.length > 0 ? scoreSum / feedbacks.length : 0,
  };
}
