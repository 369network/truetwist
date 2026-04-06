import { prisma } from '@/lib/prisma';

export type AbTestStatus = 'draft' | 'running' | 'completed' | 'cancelled';
export type TargetMetric = 'engagement_rate' | 'reach' | 'clicks';

interface CreateAbTestInput {
  userId: string;
  businessId: string;
  name: string;
  description?: string;
  targetMetric?: TargetMetric;
  minSampleSize?: number;
  startAt?: Date;
  endAt?: Date;
  variants: Array<{
    label: string;
    postId?: string;
    platform?: string;
    socialAccountId?: string;
  }>;
}

interface SignificanceResult {
  significant: boolean;
  confidence: number;
  winnerId: string | null;
  winnerLabel: string | null;
  reason: string;
}

export class AbTestService {
  async createTest(input: CreateAbTestInput): Promise<string> {
    const test = await prisma.abTest.create({
      data: {
        userId: input.userId,
        businessId: input.businessId,
        name: input.name,
        description: input.description,
        targetMetric: input.targetMetric || 'engagement_rate',
        minSampleSize: input.minSampleSize || 100,
        startAt: input.startAt,
        endAt: input.endAt,
        variants: {
          create: input.variants.map(v => ({
            label: v.label,
            postId: v.postId,
            platform: v.platform,
            socialAccountId: v.socialAccountId,
          })),
        },
      },
    });
    return test.id;
  }

  async startTest(testId: string, userId: string): Promise<void> {
    await prisma.abTest.update({
      where: { id: testId, userId },
      data: { status: 'running', startAt: new Date() },
    });
  }

  async updateVariantMetrics(
    variantId: string,
    metrics: {
      impressions: number;
      reach: number;
      engagements: number;
      likes: number;
      comments: number;
      shares: number;
      clicks: number;
    }
  ): Promise<void> {
    const engagementRate = metrics.impressions > 0
      ? (metrics.engagements / metrics.impressions) * 100
      : 0;

    await prisma.abTestVariant.update({
      where: { id: variantId },
      data: { ...metrics, engagementRate },
    });
  }

  async checkSignificance(testId: string): Promise<SignificanceResult> {
    const test = await prisma.abTest.findUniqueOrThrow({
      where: { id: testId },
      include: { variants: true },
    });

    if (test.variants.length < 2) {
      return { significant: false, confidence: 0, winnerId: null, winnerLabel: null, reason: 'Need at least 2 variants' };
    }

    const [a, b] = test.variants;
    const totalSamples = a.impressions + b.impressions;

    if (totalSamples < test.minSampleSize) {
      return {
        significant: false,
        confidence: 0,
        winnerId: null,
        winnerLabel: null,
        reason: `Insufficient sample size: ${totalSamples}/${test.minSampleSize}`,
      };
    }

    // Get the metric to compare based on targetMetric
    const metricA = this.getMetricValue(a, test.targetMetric);
    const metricB = this.getMetricValue(b, test.targetMetric);

    // Two-proportion z-test for engagement rates
    const nA = a.impressions || 1;
    const nB = b.impressions || 1;
    const pA = metricA / nA;
    const pB = metricB / nB;
    const pPooled = (metricA + metricB) / (nA + nB);

    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / nA + 1 / nB));
    const z = se > 0 ? Math.abs(pA - pB) / se : 0;

    // Convert z-score to approximate confidence
    const confidence = z >= 2.576 ? 99 : z >= 1.96 ? 95 : z >= 1.645 ? 90 : Math.min(89, Math.round(z * 50));

    const significant = confidence >= 95;
    const winner = pA > pB ? a : b;

    return {
      significant,
      confidence,
      winnerId: significant ? winner.id : null,
      winnerLabel: significant ? winner.label : null,
      reason: significant
        ? `Variant ${winner.label} wins with ${confidence}% confidence (${test.targetMetric}: ${(pA > pB ? pA : pB).toFixed(4)} vs ${(pA > pB ? pB : pA).toFixed(4)})`
        : `Not yet significant (${confidence}% confidence, need 95%)`,
    };
  }

  async completeTest(testId: string, userId: string): Promise<SignificanceResult> {
    const result = await this.checkSignificance(testId);

    await prisma.abTest.update({
      where: { id: testId, userId },
      data: {
        status: 'completed',
        endAt: new Date(),
        winnerId: result.winnerId,
        winnerReason: result.reason,
      },
    });

    return result;
  }

  async cancelTest(testId: string, userId: string): Promise<void> {
    await prisma.abTest.update({
      where: { id: testId, userId },
      data: { status: 'cancelled', endAt: new Date() },
    });
  }

  async getTestHistory(userId: string, limit = 20): Promise<unknown[]> {
    return prisma.abTest.findMany({
      where: { userId },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private getMetricValue(
    variant: { impressions: number; reach: number; engagements: number; clicks: number; engagementRate: number },
    metric: string
  ): number {
    switch (metric) {
      case 'reach': return variant.reach;
      case 'clicks': return variant.clicks;
      case 'engagement_rate':
      default:
        return variant.engagements;
    }
  }
}
