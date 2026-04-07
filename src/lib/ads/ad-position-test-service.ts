import { prisma } from '@/lib/prisma';

export type AdPosition = 'above_gallery' | 'between_images' | 'below_gallery' | 'sidebar';
export type PositionTestStatus = 'draft' | 'running' | 'completed' | 'cancelled';
export type PositionTestMetric = 'ctr' | 'viewability' | 'revenue_per_session';

interface CreatePositionTestInput {
  userId: string;
  businessId: string;
  name: string;
  description?: string;
  targetMetric?: PositionTestMetric;
  minSampleSize?: number;
  startAt?: Date;
  endAt?: Date;
  variants: Array<{
    label: string;
    position: AdPosition;
    frequency?: number;
  }>;
}

interface VariantMetricsUpdate {
  impressions?: number;
  clicks?: number;
  viewableImpressions?: number;
  revenueCents?: number;
  sessions?: number;
}

interface SignificanceResult {
  significant: boolean;
  confidence: number;
  winnerId: string | null;
  winnerLabel: string | null;
  reason: string;
}

export class AdPositionTestService {
  async createTest(input: CreatePositionTestInput): Promise<string> {
    const test = await prisma.adPositionTest.create({
      data: {
        userId: input.userId,
        businessId: input.businessId,
        name: input.name,
        description: input.description,
        targetMetric: input.targetMetric ?? 'ctr',
        minSampleSize: input.minSampleSize ?? 200,
        startAt: input.startAt,
        endAt: input.endAt,
        variants: {
          create: input.variants.map((v) => ({
            label: v.label,
            position: v.position,
            frequency: v.frequency ?? 1,
          })),
        },
      },
    });
    return test.id;
  }

  async getTest(testId: string) {
    return prisma.adPositionTest.findUnique({
      where: { id: testId },
      include: { variants: true },
    });
  }

  async listTests(userId: string, businessId: string, status?: PositionTestStatus) {
    return prisma.adPositionTest.findMany({
      where: {
        userId,
        businessId,
        ...(status ? { status } : {}),
      },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async startTest(testId: string): Promise<void> {
    const test = await prisma.adPositionTest.findUnique({
      where: { id: testId },
      include: { variants: true },
    });
    if (!test) throw new Error('Test not found');
    if (test.status !== 'draft') throw new Error('Test must be in draft to start');
    if (test.variants.length < 2) throw new Error('Need at least 2 variants');

    await prisma.adPositionTest.update({
      where: { id: testId },
      data: { status: 'running', startAt: new Date() },
    });
  }

  async recordMetrics(variantId: string, metrics: VariantMetricsUpdate): Promise<void> {
    const variant = await prisma.adPositionVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) throw new Error('Variant not found');

    const newImpressions = variant.impressions + (metrics.impressions ?? 0);
    const newClicks = variant.clicks + (metrics.clicks ?? 0);
    const newViewable = variant.viewableImpressions + (metrics.viewableImpressions ?? 0);
    const newRevenue = variant.revenueCents + (metrics.revenueCents ?? 0);
    const newSessions = variant.sessions + (metrics.sessions ?? 0);

    await prisma.adPositionVariant.update({
      where: { id: variantId },
      data: {
        impressions: newImpressions,
        clicks: newClicks,
        viewableImpressions: newViewable,
        revenueCents: newRevenue,
        sessions: newSessions,
        ctr: newImpressions > 0 ? newClicks / newImpressions : 0,
        viewability: newImpressions > 0 ? newViewable / newImpressions : 0,
        revenuePerSession: newSessions > 0 ? newRevenue / 100 / newSessions : 0,
      },
    });
  }

  /**
   * Assigns a visitor to a variant using deterministic hashing.
   * Returns the variant config for the assigned position.
   */
  assignVariant(
    testId: string,
    visitorId: string,
    variants: Array<{ id: string; label: string; position: string; frequency: number }>
  ): { variantId: string; position: string; frequency: number } {
    let hash = 0;
    const key = `${testId}:${visitorId}`;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % variants.length;
    const assigned = variants[index];
    return {
      variantId: assigned.id,
      position: assigned.position,
      frequency: assigned.frequency,
    };
  }

  async checkSignificance(testId: string): Promise<SignificanceResult> {
    const test = await prisma.adPositionTest.findUnique({
      where: { id: testId },
      include: { variants: true },
    });
    if (!test) throw new Error('Test not found');
    if (test.variants.length < 2) {
      return { significant: false, confidence: 0, winnerId: null, winnerLabel: null, reason: 'Need at least 2 variants' };
    }

    const allAboveMin = test.variants.every((v) => v.impressions >= test.minSampleSize);
    if (!allAboveMin) {
      return { significant: false, confidence: 0, winnerId: null, winnerLabel: null, reason: 'Insufficient sample size' };
    }

    // Two-proportion z-test between the top two variants by target metric
    const sorted = [...test.variants].sort((a, b) => {
      const metricA = this.getMetricValue(a, test.targetMetric);
      const metricB = this.getMetricValue(b, test.targetMetric);
      return metricB - metricA;
    });

    const best = sorted[0];
    const runnerUp = sorted[1];

    const p1 = this.getMetricValue(best, test.targetMetric);
    const p2 = this.getMetricValue(runnerUp, test.targetMetric);
    const n1 = best.impressions;
    const n2 = runnerUp.impressions;

    const pooled = (p1 * n1 + p2 * n2) / (n1 + n2);

    if (pooled === 0 || pooled === 1) {
      return { significant: false, confidence: 0, winnerId: null, winnerLabel: null, reason: 'No variance in metric' };
    }

    const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
    if (se === 0) {
      return { significant: false, confidence: 0, winnerId: null, winnerLabel: null, reason: 'Zero standard error' };
    }

    const z = (p1 - p2) / se;
    // Approximate two-tailed p-value from z-score
    const confidence = 1 - 2 * (1 - this.normalCdf(Math.abs(z)));

    const significant = confidence >= 0.95;
    return {
      significant,
      confidence,
      winnerId: significant ? best.id : null,
      winnerLabel: significant ? best.label : null,
      reason: significant
        ? `Variant ${best.label} (${best.position}) wins with ${(confidence * 100).toFixed(1)}% confidence`
        : `Not yet significant (${(confidence * 100).toFixed(1)}% confidence)`,
    };
  }

  async completeTest(testId: string): Promise<void> {
    const result = await this.checkSignificance(testId);
    await prisma.adPositionTest.update({
      where: { id: testId },
      data: {
        status: 'completed',
        endAt: new Date(),
        winnerId: result.winnerId,
        winnerReason: result.reason,
      },
    });
  }

  async cancelTest(testId: string): Promise<void> {
    await prisma.adPositionTest.update({
      where: { id: testId },
      data: { status: 'cancelled', endAt: new Date() },
    });
  }

  private getMetricValue(
    variant: { ctr: number; viewability: number; revenuePerSession: number },
    metric: string
  ): number {
    switch (metric) {
      case 'ctr': return variant.ctr;
      case 'viewability': return variant.viewability;
      case 'revenue_per_session': return variant.revenuePerSession;
      default: return variant.ctr;
    }
  }

  private normalCdf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.SQRT2;
    const t = 1 / (1 + p * absX);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return 0.5 * (1 + sign * y);
  }
}
