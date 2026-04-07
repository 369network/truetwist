import { prisma } from '@/lib/prisma';
import { queueVideoGeneration } from './video-queue-service';
import type { BrandContext, VideoAspectRatio } from './types';
import type { Platform } from '@/lib/social/types';

// ============================================
// Video A/B Test Service
// ============================================

export type VideoAbTestStatus = 'draft' | 'generating' | 'running' | 'completed' | 'cancelled';
export type VideoAbTestMetric = 'watch_time' | 'clicks' | 'conversions' | 'engagement_rate';

export interface VideoAbTestBaseConfig {
  prompt: string;
  platform: Platform;
  template?: string;
  aspectRatio?: VideoAspectRatio;
  durationSeconds?: number;
  templateContent?: Record<string, unknown>;
}

export interface VariationParam {
  field: 'headline' | 'cta' | 'music' | 'template' | 'aspectRatio';
  values: string[];
}

export interface CreateVideoAbTestInput {
  userId: string;
  businessId: string;
  name: string;
  description?: string;
  targetMetric?: VideoAbTestMetric;
  baseConfig: VideoAbTestBaseConfig;
  variationParams: VariationParam[];
  minSampleSize?: number;
}

export interface VideoAbTestSummary {
  id: string;
  name: string;
  description: string | null;
  status: VideoAbTestStatus;
  targetMetric: string;
  baseConfig: VideoAbTestBaseConfig;
  variationParams: VariationParam[];
  variants: VideoAbTestVariantSummary[];
  winnerId: string | null;
  winnerReason: string | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
}

export interface VideoAbTestVariantSummary {
  id: string;
  label: string;
  config: Record<string, unknown>;
  videoJobId: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  status: string;
  impressions: number;
  clicks: number;
  watchTimeSeconds: number;
  completionRate: number;
  conversions: number;
  engagements: number;
  engagementRate: number;
  isWinner: boolean;
}

/**
 * Create a new video A/B test and auto-generate variant configs from variation params.
 */
export async function createVideoAbTest(input: CreateVideoAbTestInput): Promise<string> {
  const variantConfigs = generateVariantConfigs(input.baseConfig, input.variationParams);

  const test = await prisma.videoAbTest.create({
    data: {
      userId: input.userId,
      businessId: input.businessId,
      name: input.name,
      description: input.description,
      targetMetric: input.targetMetric || 'watch_time',
      baseConfig: JSON.parse(JSON.stringify(input.baseConfig)),
      variationParams: JSON.parse(JSON.stringify(input.variationParams)),
      minSampleSize: input.minSampleSize || 100,
      variants: {
        create: variantConfigs.map((config, i) => ({
          label: String.fromCharCode(65 + i), // A, B, C, ...
          config: JSON.parse(JSON.stringify(config)),
        })),
      },
    },
  });

  return test.id;
}

/**
 * Generate variant configs by permuting variation parameters against the base config.
 * Generates up to 5 variants.
 */
function generateVariantConfigs(
  base: VideoAbTestBaseConfig,
  params: VariationParam[]
): Record<string, unknown>[] {
  if (params.length === 0) {
    // No variation params — create 2 variants with base config
    return [{ ...base }, { ...base }];
  }

  // For single param, create one variant per value
  if (params.length === 1) {
    const param = params[0];
    return param.values.slice(0, 5).map((value) => ({
      ...base,
      [param.field]: value,
    }));
  }

  // For multiple params, create cross-product (capped at 5)
  const configs: Record<string, unknown>[] = [];
  const firstParam = params[0];
  const restParams = params.slice(1);

  for (const value of firstParam.values) {
    for (const restConfig of generateVariantConfigs(base, restParams)) {
      configs.push({
        ...restConfig,
        [firstParam.field]: value,
      });
      if (configs.length >= 5) return configs;
    }
  }

  return configs.slice(0, 5);
}

/**
 * Kick off video generation for all variants in a test.
 */
export async function generateTestVariants(
  testId: string,
  userId: string,
  brand: BrandContext
): Promise<void> {
  const test = await prisma.videoAbTest.findFirst({
    where: { id: testId, userId },
    include: { variants: true },
  });
  if (!test) throw new Error('Test not found');

  await prisma.videoAbTest.update({
    where: { id: testId },
    data: { status: 'generating' },
  });

  const baseConfig = test.baseConfig as unknown as VideoAbTestBaseConfig;
  const batchGroup = `video-ab-test-${testId}`;

  for (const variant of test.variants) {
    const variantConfig = variant.config as Record<string, unknown>;
    const prompt = (variantConfig.prompt as string) || baseConfig.prompt;
    const platform = (variantConfig.platform as Platform) || baseConfig.platform;
    const template = (variantConfig.template as string) || baseConfig.template;
    const aspectRatio = (variantConfig.aspectRatio as VideoAspectRatio) || baseConfig.aspectRatio || '9:16';
    const durationSeconds = (variantConfig.durationSeconds as number) || baseConfig.durationSeconds || 15;

    const scriptJson: Record<string, unknown> = {};
    if (variantConfig.headline) scriptJson.headline = variantConfig.headline;
    if (variantConfig.cta) scriptJson.callToAction = variantConfig.cta;
    if (variantConfig.music) scriptJson.musicMood = variantConfig.music;

    try {
      const job = await queueVideoGeneration({
        userId,
        businessId: test.businessId,
        prompt,
        platform,
        template,
        aspectRatio,
        durationSeconds,
        scriptJson: Object.keys(scriptJson).length > 0 ? scriptJson : undefined,
        brand,
        batchGroup,
        metadata: { videoAbTestId: testId, variantId: variant.id },
      });

      await prisma.videoAbTestVariant.update({
        where: { id: variant.id },
        data: { videoJobId: job.id, status: 'generating' },
      });
    } catch (error) {
      await prisma.videoAbTestVariant.update({
        where: { id: variant.id },
        data: { status: 'failed' },
      });
    }
  }
}

/**
 * Sync variant statuses from their linked video generation jobs.
 */
export async function syncVariantStatuses(testId: string): Promise<boolean> {
  const test = await prisma.videoAbTest.findUniqueOrThrow({
    where: { id: testId },
    include: { variants: { include: { videoJob: true } } },
  });

  let allReady = true;
  let anyFailed = false;

  for (const variant of test.variants) {
    if (!variant.videoJob) continue;

    const jobStatus = variant.videoJob.status;
    if (jobStatus === 'ready') {
      await prisma.videoAbTestVariant.update({
        where: { id: variant.id },
        data: {
          status: 'ready',
          videoUrl: variant.videoJob.outputVideoUrl,
          thumbnailUrl: variant.videoJob.thumbnailUrl,
        },
      });
    } else if (jobStatus === 'failed') {
      await prisma.videoAbTestVariant.update({
        where: { id: variant.id },
        data: { status: 'failed' },
      });
      anyFailed = true;
    } else {
      allReady = false;
    }
  }

  // If all variants are ready, move test to running
  if (allReady && !anyFailed && test.status === 'generating') {
    await prisma.videoAbTest.update({
      where: { id: testId },
      data: { status: 'running', startAt: new Date() },
    });
  }

  return allReady;
}

/**
 * Update performance metrics for a variant (from manual import or ad platform sync).
 */
export async function updateVariantMetrics(
  variantId: string,
  metrics: {
    impressions?: number;
    clicks?: number;
    watchTimeSeconds?: number;
    completionRate?: number;
    conversions?: number;
    engagements?: number;
  }
): Promise<void> {
  const variant = await prisma.videoAbTestVariant.findUniqueOrThrow({
    where: { id: variantId },
  });

  const impressions = metrics.impressions ?? variant.impressions;
  const engagements = metrics.engagements ?? variant.engagements;
  const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;

  await prisma.videoAbTestVariant.update({
    where: { id: variantId },
    data: {
      ...metrics,
      engagementRate,
    },
  });
}

/**
 * Check statistical significance and determine winner.
 */
export async function checkSignificance(testId: string): Promise<{
  significant: boolean;
  confidence: number;
  winnerId: string | null;
  winnerLabel: string | null;
  reason: string;
}> {
  const test = await prisma.videoAbTest.findUniqueOrThrow({
    where: { id: testId },
    include: { variants: true },
  });

  if (test.variants.length < 2) {
    return { significant: false, confidence: 0, winnerId: null, winnerLabel: null, reason: 'Need at least 2 variants' };
  }

  const totalSamples = test.variants.reduce((sum, v) => sum + v.impressions, 0);
  if (totalSamples < test.minSampleSize) {
    return {
      significant: false,
      confidence: 0,
      winnerId: null,
      winnerLabel: null,
      reason: `Insufficient sample size: ${totalSamples}/${test.minSampleSize}`,
    };
  }

  // Compare top two variants using a two-proportion z-test
  const sorted = [...test.variants].sort((a, b) => {
    const metricA = getMetricValue(a, test.targetMetric);
    const metricB = getMetricValue(b, test.targetMetric);
    return metricB - metricA;
  });

  const [best, second] = sorted;
  const nA = best.impressions || 1;
  const nB = second.impressions || 1;
  const metricA = getMetricValue(best, test.targetMetric);
  const metricB = getMetricValue(second, test.targetMetric);
  const pA = metricA / nA;
  const pB = metricB / nB;
  const pPooled = (metricA + metricB) / (nA + nB);

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / nA + 1 / nB));
  const z = se > 0 ? Math.abs(pA - pB) / se : 0;

  const confidence = z >= 2.576 ? 99 : z >= 1.96 ? 95 : z >= 1.645 ? 90 : Math.min(89, Math.round(z * 50));
  const significant = confidence >= 95;

  return {
    significant,
    confidence,
    winnerId: significant ? best.id : null,
    winnerLabel: significant ? best.label : null,
    reason: significant
      ? `Variant ${best.label} wins with ${confidence}% confidence`
      : `Not yet significant (${confidence}% confidence, need 95%)`,
  };
}

/**
 * Complete a test and select the winner.
 */
export async function completeTest(testId: string, userId: string, manualWinnerId?: string): Promise<void> {
  const test = await prisma.videoAbTest.findFirst({
    where: { id: testId, userId },
    include: { variants: true },
  });
  if (!test) throw new Error('Test not found');

  let winnerId: string | null = null;
  let winnerReason: string;

  if (manualWinnerId) {
    const winner = test.variants.find((v) => v.id === manualWinnerId);
    if (!winner) throw new Error('Winner variant not found');
    winnerId = manualWinnerId;
    winnerReason = `Manually selected: Variant ${winner.label}`;
  } else {
    const result = await checkSignificance(testId);
    winnerId = result.winnerId;
    winnerReason = result.reason;
  }

  await prisma.videoAbTest.update({
    where: { id: testId },
    data: {
      status: 'completed',
      endAt: new Date(),
      winnerId,
      winnerReason,
    },
  });
}

/**
 * Cancel a test.
 */
export async function cancelTest(testId: string, userId: string): Promise<void> {
  await prisma.videoAbTest.update({
    where: { id: testId, userId },
    data: { status: 'cancelled', endAt: new Date() },
  });
}

/**
 * Get a test with full variant data, formatted for API response.
 */
export async function getVideoAbTest(testId: string, userId: string): Promise<VideoAbTestSummary | null> {
  const test = await prisma.videoAbTest.findFirst({
    where: { id: testId, userId },
    include: { variants: { orderBy: { label: 'asc' } } },
  });

  if (!test) return null;
  return toTestSummary(test);
}

/**
 * List tests for a user.
 */
export async function listVideoAbTests(
  userId: string,
  options?: { status?: VideoAbTestStatus; limit?: number }
): Promise<VideoAbTestSummary[]> {
  const tests = await prisma.videoAbTest.findMany({
    where: {
      userId,
      ...(options?.status ? { status: options.status } : {}),
    },
    include: { variants: { orderBy: { label: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 20,
  });

  return tests.map(toTestSummary);
}

function getMetricValue(
  variant: { impressions: number; clicks: number; watchTimeSeconds: number; conversions: number; engagements: number; engagementRate: number },
  metric: string
): number {
  switch (metric) {
    case 'clicks': return variant.clicks;
    case 'conversions': return variant.conversions;
    case 'engagement_rate': return variant.engagements;
    case 'watch_time':
    default:
      // For watch time, use average watch time per impression as the rate metric
      return variant.impressions > 0 ? variant.watchTimeSeconds : 0;
  }
}

function toTestSummary(test: {
  id: string;
  name: string;
  description: string | null;
  status: string;
  targetMetric: string;
  baseConfig: unknown;
  variationParams: unknown;
  winnerId: string | null;
  winnerReason: string | null;
  startAt: Date | null;
  endAt: Date | null;
  createdAt: Date;
  variants: Array<{
    id: string;
    label: string;
    config: unknown;
    videoJobId: string | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    status: string;
    impressions: number;
    clicks: number;
    watchTimeSeconds: number;
    completionRate: number;
    conversions: number;
    engagements: number;
    engagementRate: number;
  }>;
}): VideoAbTestSummary {
  return {
    id: test.id,
    name: test.name,
    description: test.description,
    status: test.status as VideoAbTestStatus,
    targetMetric: test.targetMetric,
    baseConfig: test.baseConfig as VideoAbTestBaseConfig,
    variationParams: test.variationParams as unknown as VariationParam[],
    winnerId: test.winnerId,
    winnerReason: test.winnerReason,
    startAt: test.startAt?.toISOString() ?? null,
    endAt: test.endAt?.toISOString() ?? null,
    createdAt: test.createdAt.toISOString(),
    variants: test.variants.map((v) => ({
      id: v.id,
      label: v.label,
      config: v.config as Record<string, unknown>,
      videoJobId: v.videoJobId,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl,
      status: v.status,
      impressions: v.impressions,
      clicks: v.clicks,
      watchTimeSeconds: v.watchTimeSeconds,
      completionRate: v.completionRate,
      conversions: v.conversions,
      engagements: v.engagements,
      engagementRate: v.engagementRate,
      isWinner: test.winnerId === v.id,
    })),
  };
}
