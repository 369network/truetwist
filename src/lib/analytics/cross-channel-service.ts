import { prisma } from '@/lib/prisma';

export interface CrossChannelMetrics {
  period: { start: string; end: string; days: number };
  organic: {
    totalImpressions: number;
    totalReach: number;
    totalEngagements: number;
    totalClicks: number;
    postCount: number;
    avgEngagementRate: number;
  };
  paid: {
    totalSpendCents: number;
    totalRevenueCents: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    overallRoas: number;
    campaignCount: number;
  };
  combined: {
    totalImpressions: number;
    totalClicks: number;
    blendedCtr: number;
    estimatedTotalReach: number;
  };
  platformBreakdown: Record<
    string,
    {
      organic: { impressions: number; engagements: number; posts: number };
      paid: { spendCents: number; revenueCents: number; impressions: number; clicks: number; conversions: number };
    }
  >;
  topicCorrelations: TopicCorrelation[];
  dailyTrend: DailyUnifiedTrend[];
}

export interface TopicCorrelation {
  topic: string;
  organicPosts: number;
  organicEngagementRate: number;
  paidCampaigns: number;
  paidRoas: number;
  paidSpendCents: number;
  recommendation: 'boost' | 'scale_paid' | 'organic_only' | 'reduce_paid';
}

export interface DailyUnifiedTrend {
  date: string;
  organicImpressions: number;
  organicEngagements: number;
  paidImpressions: number;
  paidSpendCents: number;
  paidRevenueCents: number;
  paidRoas: number;
}

export interface BoostRecommendation {
  postId: string;
  postScheduleId: string;
  platform: string;
  contentPreview: string;
  engagementRate: number;
  impressions: number;
  score: number;
  reason: string;
  suggestedBudgetCents: number;
  estimatedReach: number;
}

export class CrossChannelService {
  /**
   * Get unified organic + paid analytics for a user's businesses.
   */
  async getUnifiedAnalytics(
    userId: string,
    days: number = 30,
    businessId?: string
  ): Promise<CrossChannelMetrics> {
    const startDate = new Date(Date.now() - days * 86400000);
    const endDate = new Date();

    const businessIds = businessId
      ? [businessId]
      : await this.getUserBusinessIds(userId);

    const [organicData, paidData] = await Promise.all([
      this.getOrganicMetrics(userId, businessIds, startDate, endDate),
      this.getPaidMetrics(businessIds, startDate, endDate),
    ]);

    const platformBreakdown = this.buildPlatformBreakdown(organicData, paidData);
    const topicCorrelations = this.buildTopicCorrelations(organicData, paidData);
    const dailyTrend = this.buildDailyTrend(organicData, paidData, days);

    const totalOrganicImpressions = organicData.posts.reduce((s, p) => s + p.impressions, 0);
    const totalOrganicReach = organicData.posts.reduce((s, p) => s + p.reach, 0);
    const totalOrganicEngagements = organicData.posts.reduce(
      (s, p) => s + p.likes + p.comments + p.shares + p.saves,
      0
    );
    const totalOrganicClicks = organicData.posts.reduce((s, p) => s + p.clicks, 0);
    const avgEngagementRate =
      organicData.posts.length > 0
        ? organicData.posts.reduce((s, p) => s + p.engagementRate, 0) / organicData.posts.length
        : 0;

    const totalPaidSpend = paidData.snapshots.reduce((s, m) => s + m.spendCents, 0);
    const totalPaidRevenue = paidData.snapshots.reduce((s, m) => s + m.revenueCents, 0);
    const totalPaidImpressions = paidData.snapshots.reduce((s, m) => s + m.impressions, 0);
    const totalPaidClicks = paidData.snapshots.reduce((s, m) => s + m.clicks, 0);
    const totalPaidConversions = paidData.snapshots.reduce((s, m) => s + m.conversions, 0);

    const combinedImpressions = totalOrganicImpressions + totalPaidImpressions;
    const combinedClicks = totalOrganicClicks + totalPaidClicks;

    return {
      period: { start: startDate.toISOString(), end: endDate.toISOString(), days },
      organic: {
        totalImpressions: totalOrganicImpressions,
        totalReach: totalOrganicReach,
        totalEngagements: totalOrganicEngagements,
        totalClicks: totalOrganicClicks,
        postCount: organicData.posts.length,
        avgEngagementRate,
      },
      paid: {
        totalSpendCents: totalPaidSpend,
        totalRevenueCents: totalPaidRevenue,
        totalImpressions: totalPaidImpressions,
        totalClicks: totalPaidClicks,
        totalConversions: totalPaidConversions,
        overallRoas: totalPaidSpend > 0 ? totalPaidRevenue / totalPaidSpend : 0,
        campaignCount: paidData.campaignCount,
      },
      combined: {
        totalImpressions: combinedImpressions,
        totalClicks: combinedClicks,
        blendedCtr: combinedImpressions > 0 ? (combinedClicks / combinedImpressions) * 100 : 0,
        estimatedTotalReach: totalOrganicReach + Math.round(totalPaidImpressions * 0.7),
      },
      platformBreakdown,
      topicCorrelations,
      dailyTrend,
    };
  }

  /**
   * Find top organic posts worth boosting with paid ads.
   */
  async getBoostRecommendations(
    userId: string,
    limit: number = 5,
    businessId?: string
  ): Promise<BoostRecommendation[]> {
    const businessIds = businessId
      ? [businessId]
      : await this.getUserBusinessIds(userId);

    // Get recent high-performing organic posts (last 14 days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

    const socialAccounts = await prisma.socialAccount.findMany({
      where: { userId },
      select: { id: true, platform: true },
    });
    const accountIds = socialAccounts.map((a) => a.id);

    const schedules = await prisma.postSchedule.findMany({
      where: {
        socialAccountId: { in: accountIds },
        status: 'posted',
        postedAt: { gte: fourteenDaysAgo },
      },
      include: {
        analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
        post: { select: { id: true, contentText: true, contentType: true } },
        socialAccount: { select: { platform: true } },
      },
    });

    // Get paid campaign names for overlap detection
    const adAccounts = await prisma.adAccount.findMany({
      where: { businessId: { in: businessIds } },
      include: { campaigns: { where: { status: 'active' }, select: { name: true } } },
    });
    const activeCampaignNames = new Set(
      adAccounts.flatMap((a) => a.campaigns.map((c) => c.name.toLowerCase()))
    );

    const candidates: BoostRecommendation[] = [];

    for (const sched of schedules) {
      const analytics = sched.analytics[0];
      if (!analytics || analytics.impressions < 50) continue;

      const engagementRate = analytics.engagementRate;
      const impressions = analytics.impressions;

      // Score: high engagement + moderate reach = good boost candidate
      // Posts that are already going viral organically don't need boosting as much
      const reachEfficiency = analytics.reach > 0 ? analytics.impressions / analytics.reach : 1;
      const score = engagementRate * 100 + Math.log10(impressions + 1) * 10 - reachEfficiency * 5;

      // Skip if content already has an active paid campaign (heuristic: name match)
      const contentWords = (sched.post?.contentText || '').toLowerCase().split(/\s+/).slice(0, 5);
      const alreadyBoosted = contentWords.some((w) =>
        [...activeCampaignNames].some((name) => name.includes(w) && w.length > 3)
      );
      if (alreadyBoosted) continue;

      let reason: string;
      if (engagementRate > 5) {
        reason = 'Exceptional engagement rate — strong candidate for paid amplification';
      } else if (engagementRate > 3) {
        reason = 'Above-average engagement signals content resonance with audience';
      } else if (impressions > 1000 && engagementRate > 1.5) {
        reason = 'Good reach with solid engagement — paid boost could scale impact';
      } else {
        reason = 'Moderate performer that could benefit from targeted paid reach';
      }

      // Budget suggestion: $5-50 based on organic performance
      const suggestedBudgetCents = Math.min(
        5000,
        Math.max(500, Math.round(engagementRate * 500 + impressions * 0.5))
      );

      candidates.push({
        postId: sched.post?.id || sched.postId,
        postScheduleId: sched.id,
        platform: sched.socialAccount.platform,
        contentPreview: (sched.post?.contentText || '').slice(0, 140),
        engagementRate,
        impressions,
        score,
        reason,
        suggestedBudgetCents,
        estimatedReach: Math.round(impressions * (suggestedBudgetCents / 1000) * 2.5),
      });
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // --- Private helpers ---

  private async getUserBusinessIds(userId: string): Promise<string[]> {
    const businesses = await prisma.business.findMany({
      where: { userId },
      select: { id: true },
    });
    return businesses.map((b) => b.id);
  }

  private async getOrganicMetrics(
    userId: string,
    businessIds: string[],
    start: Date,
    end: Date
  ) {
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { userId },
      select: { id: true, platform: true },
    });
    const accountIds = socialAccounts.map((a) => a.id);
    const platformMap = new Map(socialAccounts.map((a) => [a.id, a.platform]));

    const schedules = await prisma.postSchedule.findMany({
      where: {
        socialAccountId: { in: accountIds },
        status: 'posted',
        postedAt: { gte: start, lte: end },
      },
      include: {
        analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
        post: { select: { contentText: true, contentType: true } },
      },
    });

    const posts = schedules
      .filter((s) => s.analytics.length > 0)
      .map((s) => ({
        ...s.analytics[0],
        platform: platformMap.get(s.socialAccountId) || 'unknown',
        postedAt: s.postedAt,
        contentText: s.post?.contentText || '',
        contentType: s.post?.contentType || 'text',
      }));

    return { posts };
  }

  private async getPaidMetrics(businessIds: string[], start: Date, end: Date) {
    const adAccounts = await prisma.adAccount.findMany({
      where: { businessId: { in: businessIds } },
      select: { id: true, platform: true },
    });
    const accountIds = adAccounts.map((a) => a.id);
    const platformMap = new Map(adAccounts.map((a) => [a.id, a.platform]));

    const snapshots = await prisma.adMetricSnapshot.findMany({
      where: {
        adAccountId: { in: accountIds },
        date: { gte: start, lte: end },
      },
      include: {
        campaign: { select: { id: true, name: true, status: true, objective: true } },
      },
    });

    const enriched = snapshots.map((s) => ({
      ...s,
      platform: platformMap.get(s.adAccountId) || 'unknown',
    }));

    const campaignIds = new Set(snapshots.map((s) => s.campaignId).filter(Boolean));

    return { snapshots: enriched, campaignCount: campaignIds.size };
  }

  private buildPlatformBreakdown(
    organicData: { posts: Array<{ platform: string; impressions: number; likes: number; comments: number; shares: number; saves: number }> },
    paidData: { snapshots: Array<{ platform: string; spendCents: number; revenueCents: number; impressions: number; clicks: number; conversions: number }> }
  ) {
    const breakdown: CrossChannelMetrics['platformBreakdown'] = {};

    for (const post of organicData.posts) {
      if (!breakdown[post.platform]) {
        breakdown[post.platform] = {
          organic: { impressions: 0, engagements: 0, posts: 0 },
          paid: { spendCents: 0, revenueCents: 0, impressions: 0, clicks: 0, conversions: 0 },
        };
      }
      breakdown[post.platform].organic.impressions += post.impressions;
      breakdown[post.platform].organic.engagements += post.likes + post.comments + post.shares + post.saves;
      breakdown[post.platform].organic.posts += 1;
    }

    for (const snap of paidData.snapshots) {
      if (!breakdown[snap.platform]) {
        breakdown[snap.platform] = {
          organic: { impressions: 0, engagements: 0, posts: 0 },
          paid: { spendCents: 0, revenueCents: 0, impressions: 0, clicks: 0, conversions: 0 },
        };
      }
      breakdown[snap.platform].paid.spendCents += snap.spendCents;
      breakdown[snap.platform].paid.revenueCents += snap.revenueCents;
      breakdown[snap.platform].paid.impressions += snap.impressions;
      breakdown[snap.platform].paid.clicks += snap.clicks;
      breakdown[snap.platform].paid.conversions += snap.conversions;
    }

    return breakdown;
  }

  private buildTopicCorrelations(
    organicData: { posts: Array<{ contentText: string; engagementRate: number; platform: string }> },
    paidData: { snapshots: Array<{ campaign: { name: string } | null; spendCents: number; revenueCents: number }> }
  ): TopicCorrelation[] {
    // Extract topics from organic content (simple keyword extraction)
    const topicMap = new Map<string, { posts: number; totalEngagement: number; campaignCount: number; totalSpend: number; totalRevenue: number }>();

    for (const post of organicData.posts) {
      const words = (post.contentText || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 4);

      const uniqueWords = [...new Set(words)];
      for (const word of uniqueWords.slice(0, 5)) {
        if (!topicMap.has(word)) {
          topicMap.set(word, { posts: 0, totalEngagement: 0, campaignCount: 0, totalSpend: 0, totalRevenue: 0 });
        }
        const topic = topicMap.get(word)!;
        topic.posts += 1;
        topic.totalEngagement += post.engagementRate;
      }
    }

    // Match topics to paid campaign names
    for (const snap of paidData.snapshots) {
      const campaignName = (snap.campaign?.name || '').toLowerCase();
      for (const [topic, data] of topicMap) {
        if (campaignName.includes(topic)) {
          data.campaignCount += 1;
          data.totalSpend += snap.spendCents;
          data.totalRevenue += snap.revenueCents;
        }
      }
    }

    // Build correlations for topics with enough data
    return [...topicMap.entries()]
      .filter(([, data]) => data.posts >= 2)
      .map(([topic, data]) => {
        const organicEngagementRate = data.posts > 0 ? data.totalEngagement / data.posts : 0;
        const paidRoas = data.totalSpend > 0 ? data.totalRevenue / data.totalSpend : 0;

        let recommendation: TopicCorrelation['recommendation'];
        if (organicEngagementRate > 3 && data.campaignCount === 0) {
          recommendation = 'boost';
        } else if (paidRoas > 2 && organicEngagementRate > 2) {
          recommendation = 'scale_paid';
        } else if (organicEngagementRate > 3 && paidRoas < 1) {
          recommendation = 'organic_only';
        } else if (paidRoas < 0.5 && data.totalSpend > 0) {
          recommendation = 'reduce_paid';
        } else {
          recommendation = 'boost';
        }

        return {
          topic,
          organicPosts: data.posts,
          organicEngagementRate,
          paidCampaigns: data.campaignCount,
          paidRoas,
          paidSpendCents: data.totalSpend,
          recommendation,
        };
      })
      .sort((a, b) => b.organicEngagementRate - a.organicEngagementRate)
      .slice(0, 10);
  }

  private buildDailyTrend(
    organicData: { posts: Array<{ postedAt: Date | null; impressions: number; likes: number; comments: number; shares: number; saves: number }> },
    paidData: { snapshots: Array<{ date: Date; impressions: number; spendCents: number; revenueCents: number }> },
    days: number
  ): DailyUnifiedTrend[] {
    const buckets: Record<
      string,
      { organicImpressions: number; organicEngagements: number; paidImpressions: number; paidSpendCents: number; paidRevenueCents: number }
    > = {};

    for (const post of organicData.posts) {
      if (!post.postedAt) continue;
      const key = new Date(post.postedAt).toISOString().slice(0, 10);
      if (!buckets[key]) {
        buckets[key] = { organicImpressions: 0, organicEngagements: 0, paidImpressions: 0, paidSpendCents: 0, paidRevenueCents: 0 };
      }
      buckets[key].organicImpressions += post.impressions;
      buckets[key].organicEngagements += post.likes + post.comments + post.shares + post.saves;
    }

    for (const snap of paidData.snapshots) {
      const key = new Date(snap.date).toISOString().slice(0, 10);
      if (!buckets[key]) {
        buckets[key] = { organicImpressions: 0, organicEngagements: 0, paidImpressions: 0, paidSpendCents: 0, paidRevenueCents: 0 };
      }
      buckets[key].paidImpressions += snap.impressions;
      buckets[key].paidSpendCents += snap.spendCents;
      buckets[key].paidRevenueCents += snap.revenueCents;
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-days)
      .map(([date, data]) => ({
        date,
        organicImpressions: data.organicImpressions,
        organicEngagements: data.organicEngagements,
        paidImpressions: data.paidImpressions,
        paidSpendCents: data.paidSpendCents,
        paidRevenueCents: data.paidRevenueCents,
        paidRoas: data.paidSpendCents > 0 ? data.paidRevenueCents / data.paidSpendCents : 0,
      }));
  }
}
