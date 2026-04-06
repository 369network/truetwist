import type { ViralScoreInput, ViralScoreResult, TrendLifecycle } from './types';
import { FORMAT_MULTIPLIERS, HALF_LIVES } from './types';

// Weights from TRUA-26 research
const W1 = 0.30; // engagement velocity
const W2 = 0.30; // engagement acceleration
const W3 = 0.25; // share ratio
const W4 = 0.15; // reach velocity
const SENTIMENT_ALPHA = 0.4;

/**
 * Computes the viral score using the formula from TRUA-26 research:
 * VS_final = [w1*EV_norm + w2*EA + w3*Share_Ratio + w4*Reach_Velocity]
 *            * format_multiplier * S_weight * D_adaptive(t)
 *
 * Normalized to 0-100 display scale.
 */
export function computeViralScore(input: ViralScoreInput): ViralScoreResult {
  const evNorm = computeEngagementVelocity(input.engagements, input.followers, input.hours);
  const ea = input.acceleration;
  const shareRatio = Math.min(input.shareRatio, 1);
  const reachVelRaw = input.reachHours > 0 ? input.nonFollowerReach / input.reachHours : 0;

  // Normalize each component to 0-1 range using log scaling
  const evComponent = Math.min(1, Math.log1p(evNorm * 100) / Math.log1p(100));
  const eaComponent = Math.min(1, Math.log1p(Math.abs(ea) * 10) / Math.log1p(10));
  const reachComponent = Math.min(1, Math.log1p(reachVelRaw) / Math.log1p(100000));

  const formatMult = getFormatMultiplier(input.platform, input.contentFormat);
  const sentimentWeight = 1 + SENTIMENT_ALPHA * clamp(input.sentimentScore, -1, 1);
  const timeDecay = computeAdaptiveDecay(
    input.platform,
    input.ageHours,
    input.currentVelocity,
    input.peakVelocity
  );

  // Weighted sum of normalized components (0-1) * multipliers
  const rawScore =
    (W1 * evComponent + W2 * eaComponent + W3 * shareRatio + W4 * reachComponent) *
    formatMult *
    sentimentWeight *
    timeDecay;

  // Scale to 0-100 (rawScore is roughly 0-2 after multipliers)
  const score = clamp(rawScore * 100, 0, 100);

  const lifecycle = determineLifecycle(ea, timeDecay, score, input.ageHours);

  return {
    score: Math.round(score * 100) / 100,
    velocity: evNorm,
    acceleration: ea,
    lifecycle,
    components: {
      engagementVelocity: evNorm,
      engagementAcceleration: ea,
      shareComponent: shareRatio,
      reachVelocity: reachVelRaw,
      formatMultiplier: formatMult,
      sentimentWeight,
      timeDecay,
    },
  };
}

/**
 * EV_norm = (Engagements / Followers) / hours
 * Normalized engagement velocity - how fast engagement accumulates relative to audience.
 */
function computeEngagementVelocity(engagements: number, followers: number, hours: number): number {
  if (followers <= 0 || hours <= 0) return 0;
  return (engagements / followers) / hours;
}

/**
 * Adaptive time decay: lambda(t) = lambda_base * (1 - beta * EV_recent / EV_peak)
 * Decay slows if engagement persists (content still gaining traction).
 */
function computeAdaptiveDecay(
  platform: string,
  ageHours: number,
  currentVelocity: number,
  peakVelocity: number
): number {
  const halfLife = HALF_LIVES[platform] ?? 24;
  const lambdaBase = Math.LN2 / halfLife;
  const beta = 0.5;

  const velocityRatio = peakVelocity > 0 ? currentVelocity / peakVelocity : 0;
  const adaptiveLambda = lambdaBase * (1 - beta * clamp(velocityRatio, 0, 1));

  return Math.exp(-adaptiveLambda * ageHours);
}

function getFormatMultiplier(platform: string, format: string): number {
  return FORMAT_MULTIPLIERS[platform]?.[format] ?? 1.0;
}

function determineLifecycle(
  acceleration: number,
  timeDecay: number,
  score: number,
  ageHours: number
): TrendLifecycle {
  if (score < 5) return 'expired';
  if (timeDecay < 0.1) return 'declining';
  if (ageHours < 2 && acceleration > 0) return 'emerging';
  if (acceleration > 0.5) return 'rising';
  if (acceleration < -0.3) return 'declining';
  if (score > 60) return 'peaking';
  return 'emerging';
}

function sigmoid(x: number, midpoint: number): number {
  return 1 / (1 + Math.exp(-4 * (x - midpoint)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Simplified viral score for trends where we only have basic metrics.
 * Used during initial collection when detailed engagement data is unavailable.
 */
export function computeSimpleViralScore(
  volume: number,
  velocity: number,
  platform: string
): number {
  const platformWeight = platform === 'youtube' ? 0.8 : platform === 'twitter' ? 1.2 : 1.0;
  const raw = (Math.log10(Math.max(volume, 1)) * 5 + Math.log1p(velocity) * 5) * platformWeight;
  return clamp(Math.round(raw * 100) / 100, 0, 100);
}
