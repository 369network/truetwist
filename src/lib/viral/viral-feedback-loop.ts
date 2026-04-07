/**
 * Viral Prediction Feedback Loop
 *
 * Compares predicted viral scores against actual post performance.
 * Uses prediction errors to calibrate the scoring model over time.
 * Should be run periodically (e.g., daily) for posts with 24h+ of analytics data.
 */

import { prisma } from "@/lib/prisma";
import { computeViralScore } from "./viral-score";
import type { ViralScoreInput } from "./types";

export interface CalibrationResult {
  postsAnalyzed: number;
  meanAbsoluteError: number; // average |predicted - actual| on 0-100 scale
  meanBias: number; // positive = model over-predicts
  calibrationFactor: number; // multiply predictions by this to recalibrate
  topPredictionErrors: PredictionError[];
}

export interface PredictionError {
  postId: string;
  platform: string;
  predictedScore: number;
  actualScore: number;
  error: number;
}

/**
 * Analyzes recent posts to compute prediction accuracy and calibration adjustments.
 * Compares stored viral score predictions against actual engagement performance.
 */
export async function runCalibrationLoop(
  userId: string,
  lookbackDays = 30,
  minPostAge24h = true,
): Promise<CalibrationResult> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  const minPostDate = minPostAge24h
    ? new Date(Date.now() - 24 * 60 * 60 * 1000)
    : new Date();

  // Fetch posts with analytics that have had time to accumulate engagement
  const schedules = await prisma.postSchedule.findMany({
    where: {
      post: { userId },
      status: "posted",
      postedAt: { gte: cutoff, lte: minPostDate },
    },
    include: {
      post: true,
      analytics: {
        orderBy: { fetchedAt: "desc" },
        take: 1,
      },
      socialAccount: {
        select: { platform: true, followerCount: true },
      },
    },
    orderBy: { postedAt: "desc" },
    take: 200,
  });

  const errors: PredictionError[] = [];

  for (const schedule of schedules) {
    const a = schedule.analytics[0];
    if (!a || !schedule.postedAt) continue;

    const followers = schedule.socialAccount?.followerCount ?? 1000;
    const ageHours =
      (Date.now() - schedule.postedAt.getTime()) / (1000 * 60 * 60);

    // Compute engagements as sum of likes, comments, shares, saves, clicks
    const engagements = a.likes + a.comments + a.shares + a.saves + a.clicks;

    // Compute what the model would predict given actual engagement data
    const input: ViralScoreInput = {
      engagements,
      followers,
      hours: Math.min(ageHours, 48), // cap at 48h for fair comparison
      acceleration: 0, // we don't have multi-snapshot data per post
      shareRatio: engagements > 0 ? a.shares / engagements : 0,
      nonFollowerReach: Math.max(0, a.reach - followers),
      reachHours: Math.min(ageHours, 48),
      platform: schedule.platform,
      contentFormat: "post",
      sentimentScore: 0,
      ageHours: Math.min(ageHours, 48),
      currentVelocity: engagements / Math.max(ageHours, 1),
      peakVelocity: engagements / Math.max(ageHours, 1),
    };

    const predicted = computeViralScore(input);

    // Actual performance score: normalized engagement rate * 100
    const engagementRate = followers > 0 ? (engagements / followers) * 100 : 0;
    // Scale to 0-100: 1% ER = ~50 score, 5% ER = ~90 score (logarithmic)
    const actualScore = Math.min(100, Math.log1p(engagementRate) * 30);

    errors.push({
      postId: schedule.postId,
      platform: schedule.platform,
      predictedScore: predicted.score,
      actualScore: Math.round(actualScore * 100) / 100,
      error: predicted.score - actualScore,
    });
  }

  if (errors.length === 0) {
    return {
      postsAnalyzed: 0,
      meanAbsoluteError: 0,
      meanBias: 0,
      calibrationFactor: 1.0,
      topPredictionErrors: [],
    };
  }

  const meanAbsoluteError =
    errors.reduce((sum, e) => sum + Math.abs(e.error), 0) / errors.length;
  const meanBias = errors.reduce((sum, e) => sum + e.error, 0) / errors.length;

  // Calibration factor: ratio of actual to predicted means
  const avgPredicted =
    errors.reduce((s, e) => s + e.predictedScore, 0) / errors.length;
  const avgActual =
    errors.reduce((s, e) => s + e.actualScore, 0) / errors.length;
  const calibrationFactor =
    avgPredicted > 0
      ? Math.round((avgActual / avgPredicted) * 1000) / 1000
      : 1.0;

  // Top 5 worst prediction errors
  const topErrors = [...errors]
    .sort((a, b) => Math.abs(b.error) - Math.abs(a.error))
    .slice(0, 5);

  return {
    postsAnalyzed: errors.length,
    meanAbsoluteError: Math.round(meanAbsoluteError * 100) / 100,
    meanBias: Math.round(meanBias * 100) / 100,
    calibrationFactor,
    topPredictionErrors: topErrors,
  };
}

/**
 * Applies a calibration factor to a raw viral score.
 * Use the calibrationFactor from runCalibrationLoop to adjust predictions.
 */
export function applyCalibration(
  rawScore: number,
  calibrationFactor: number,
): number {
  return Math.max(
    0,
    Math.min(100, Math.round(rawScore * calibrationFactor * 100) / 100),
  );
}
