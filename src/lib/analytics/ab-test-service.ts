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

interface BayesianResult {
  probabilityBWins: number;     // P(B > A), 0-1
  expectedLiftPercent: number;  // expected % improvement of B over A
  credibleInterval: [number, number]; // 90% credible interval on lift
  sufficient: boolean;          // true if >95% or <5%
  reason: string;
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

  /**
   * Bayesian significance test using Beta-Binomial model.
   * Converges faster than z-test with small sample sizes.
   * Returns P(variant B > variant A) via Monte Carlo simulation.
   */
  async checkBayesianSignificance(testId: string, simulations = 10000): Promise<BayesianResult> {
    const test = await prisma.abTest.findUniqueOrThrow({
      where: { id: testId },
      include: { variants: true },
    });

    if (test.variants.length < 2) {
      return {
        probabilityBWins: 0.5,
        expectedLiftPercent: 0,
        credibleInterval: [0, 0],
        sufficient: false,
        reason: 'Need at least 2 variants',
      };
    }

    const [a, b] = test.variants;
    const metricA = this.getMetricValue(a, test.targetMetric);
    const metricB = this.getMetricValue(b, test.targetMetric);

    // Beta prior: uninformative (alpha=1, beta=1)
    const alphaA = 1 + metricA;
    const betaA = 1 + (a.impressions - metricA);
    const alphaB = 1 + metricB;
    const betaB = 1 + (b.impressions - metricB);

    // Monte Carlo: sample from Beta distributions, count how often B > A
    let bWins = 0;
    const lifts: number[] = [];

    for (let i = 0; i < simulations; i++) {
      const sampleA = sampleBeta(alphaA, betaA);
      const sampleB = sampleBeta(alphaB, betaB);
      if (sampleB > sampleA) bWins++;
      if (sampleA > 0) lifts.push((sampleB - sampleA) / sampleA);
    }

    const probabilityBWins = bWins / simulations;
    lifts.sort((a, b) => a - b);
    const ci5 = lifts[Math.floor(lifts.length * 0.05)] ?? 0;
    const ci95 = lifts[Math.floor(lifts.length * 0.95)] ?? 0;
    const expectedLift = lifts.reduce((s, v) => s + v, 0) / lifts.length;

    const sufficient = probabilityBWins > 0.95 || probabilityBWins < 0.05;

    return {
      probabilityBWins: Math.round(probabilityBWins * 10000) / 10000,
      expectedLiftPercent: Math.round(expectedLift * 10000) / 100,
      credibleInterval: [
        Math.round(ci5 * 10000) / 100,
        Math.round(ci95 * 10000) / 100,
      ],
      sufficient,
      reason: sufficient
        ? `${probabilityBWins > 0.5 ? b.label : a.label} wins with ${Math.round(Math.max(probabilityBWins, 1 - probabilityBWins) * 100)}% probability`
        : `Insufficient evidence (P(B wins) = ${Math.round(probabilityBWins * 100)}%, need >95%)`,
    };
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

/**
 * Sample from a Beta distribution using the Jöhnk algorithm.
 * This is a simple, dependency-free implementation.
 */
function sampleBeta(alpha: number, beta: number): number {
  if (alpha <= 0 || beta <= 0) return 0.5;

  // Use Gamma sampling: Beta(a,b) = G(a) / (G(a) + G(b))
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

function sampleGamma(shape: number): number {
  if (shape < 1) {
    // Ahrens-Dieter for shape < 1
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }

  // Marsaglia and Tsang's method for shape >= 1
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x: number;
    let v: number;
    do {
      x = normalRandom();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();

    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function normalRandom(): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
