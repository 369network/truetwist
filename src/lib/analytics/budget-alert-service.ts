import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const logger = createLogger('budget-alerts');

export interface BudgetAlert {
  id: string;
  type: 'roas_underperform' | 'spend_spike' | 'budget_exhaustion' | 'conversion_drop' | 'cpc_spike';
  severity: 'critical' | 'warning' | 'info';
  campaignId: string;
  campaignName: string;
  platform: string;
  title: string;
  message: string;
  metric: { current: number; threshold: number; unit: string };
  detectedAt: string;
}

export interface AlertDigest {
  userId: string;
  generatedAt: string;
  period: { start: string; end: string };
  alerts: BudgetAlert[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    totalSpendCents: number;
    avgRoas: number;
  };
}

export class BudgetAlertService {
  /**
   * Scan all campaigns for a user and generate alerts.
   */
  async generateAlerts(userId: string, businessId?: string): Promise<AlertDigest> {
    const businessIds = businessId
      ? [businessId]
      : (await prisma.business.findMany({ where: { userId }, select: { id: true } })).map((b) => b.id);

    const adAccounts = await prisma.adAccount.findMany({
      where: { businessId: { in: businessIds } },
      select: { id: true, platform: true },
    });
    const accountIds = adAccounts.map((a) => a.id);
    const platformMap = new Map(adAccounts.map((a) => [a.id, a.platform]));

    // Get last 7 days of metrics for trend analysis
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);

    const snapshots = await prisma.adMetricSnapshot.findMany({
      where: {
        adAccountId: { in: accountIds },
        date: { gte: sevenDaysAgo },
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            dailyBudgetCents: true,
            objective: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const alerts: BudgetAlert[] = [];

    // Group snapshots by campaign
    const byCampaign = new Map<string, typeof snapshots>();
    for (const snap of snapshots) {
      if (!snap.campaign) continue;
      const key = snap.campaign.id;
      if (!byCampaign.has(key)) byCampaign.set(key, []);
      byCampaign.get(key)!.push(snap);
    }

    let alertIdx = 0;
    let totalSpend = 0;
    let totalRevenue = 0;

    for (const [campaignId, campaignSnaps] of byCampaign) {
      const campaign = campaignSnaps[0].campaign!;
      if (campaign.status !== 'active') continue;

      const platform = platformMap.get(campaignSnaps[0].adAccountId) || 'unknown';
      const recentSnaps = campaignSnaps.filter((s) => s.date >= threeDaysAgo);

      const totalCampaignSpend = recentSnaps.reduce((s, m) => s + m.spendCents, 0);
      const totalCampaignRevenue = recentSnaps.reduce((s, m) => s + m.revenueCents, 0);
      const totalCampaignConversions = recentSnaps.reduce((s, m) => s + m.conversions, 0);
      const totalCampaignClicks = recentSnaps.reduce((s, m) => s + m.clicks, 0);

      totalSpend += totalCampaignSpend;
      totalRevenue += totalCampaignRevenue;

      const roas = totalCampaignSpend > 0 ? totalCampaignRevenue / totalCampaignSpend : 0;

      // Alert 1: ROAS below 1.0 for 3+ days
      if (roas < 1.0 && totalCampaignSpend > 500 && recentSnaps.length >= 3) {
        const allBelow = recentSnaps.every(
          (s) => s.spendCents > 0 && s.revenueCents / s.spendCents < 1.0
        );
        if (allBelow) {
          alerts.push({
            id: `alert-${++alertIdx}`,
            type: 'roas_underperform',
            severity: 'critical',
            campaignId,
            campaignName: campaign.name,
            platform,
            title: `${campaign.name}: ROAS below 1.0x for 3+ days`,
            message: `Campaign "${campaign.name}" on ${platform} has maintained ROAS of ${roas.toFixed(2)}x over the last ${recentSnaps.length} days, spending $${(totalCampaignSpend / 100).toFixed(2)} with only $${(totalCampaignRevenue / 100).toFixed(2)} in revenue. Consider pausing or optimizing targeting.`,
            metric: { current: roas, threshold: 1.0, unit: 'x ROAS' },
            detectedAt: new Date().toISOString(),
          });
        }
      }

      // Alert 2: Spend spike (today > 1.5x average of prior days)
      if (campaignSnaps.length >= 3) {
        const sorted = [...campaignSnaps].sort((a, b) => b.date.getTime() - a.date.getTime());
        const latest = sorted[0];
        const priorAvg =
          sorted.slice(1).reduce((s, m) => s + m.spendCents, 0) / (sorted.length - 1);
        if (priorAvg > 0 && latest.spendCents > priorAvg * 1.5) {
          alerts.push({
            id: `alert-${++alertIdx}`,
            type: 'spend_spike',
            severity: 'warning',
            campaignId,
            campaignName: campaign.name,
            platform,
            title: `${campaign.name}: Spend spike detected`,
            message: `Daily spend of $${(latest.spendCents / 100).toFixed(2)} is ${((latest.spendCents / priorAvg - 1) * 100).toFixed(0)}% above the ${sorted.length - 1}-day average of $${(priorAvg / 100).toFixed(2)}.`,
            metric: { current: latest.spendCents / 100, threshold: priorAvg / 100, unit: 'USD/day' },
            detectedAt: new Date().toISOString(),
          });
        }
      }

      // Alert 3: CPC spike
      if (totalCampaignClicks > 0 && campaignSnaps.length >= 3) {
        const currentCpc = totalCampaignSpend / totalCampaignClicks;
        const olderSnaps = campaignSnaps.filter((s) => s.date < threeDaysAgo);
        const olderClicks = olderSnaps.reduce((s, m) => s + m.clicks, 0);
        const olderSpend = olderSnaps.reduce((s, m) => s + m.spendCents, 0);
        if (olderClicks > 0) {
          const olderCpc = olderSpend / olderClicks;
          if (currentCpc > olderCpc * 1.5 && olderCpc > 0) {
            alerts.push({
              id: `alert-${++alertIdx}`,
              type: 'cpc_spike',
              severity: 'warning',
              campaignId,
              campaignName: campaign.name,
              platform,
              title: `${campaign.name}: CPC increased significantly`,
              message: `Cost per click rose from $${(olderCpc / 100).toFixed(2)} to $${(currentCpc / 100).toFixed(2)} — audience fatigue or competition may be increasing.`,
              metric: { current: currentCpc / 100, threshold: olderCpc / 100, unit: 'USD/click' },
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }

      // Alert 4: Conversion drop
      if (campaignSnaps.length >= 5) {
        const olderSnaps = campaignSnaps.filter((s) => s.date < threeDaysAgo);
        const olderConversions = olderSnaps.reduce((s, m) => s + m.conversions, 0);
        const olderDays = olderSnaps.length || 1;
        const recentDays = recentSnaps.length || 1;
        const oldAvg = olderConversions / olderDays;
        const newAvg = totalCampaignConversions / recentDays;
        if (oldAvg > 1 && newAvg < oldAvg * 0.5) {
          alerts.push({
            id: `alert-${++alertIdx}`,
            type: 'conversion_drop',
            severity: 'warning',
            campaignId,
            campaignName: campaign.name,
            platform,
            title: `${campaign.name}: Conversion rate dropped`,
            message: `Average daily conversions fell from ${oldAvg.toFixed(1)} to ${newAvg.toFixed(1)} — review landing page or targeting.`,
            metric: { current: newAvg, threshold: oldAvg * 0.5, unit: 'conversions/day' },
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const digest: AlertDigest = {
      userId,
      generatedAt: new Date().toISOString(),
      period: { start: sevenDaysAgo.toISOString(), end: new Date().toISOString() },
      alerts,
      summary: {
        critical: alerts.filter((a) => a.severity === 'critical').length,
        warning: alerts.filter((a) => a.severity === 'warning').length,
        info: alerts.filter((a) => a.severity === 'info').length,
        totalSpendCents: totalSpend,
        avgRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      },
    };

    logger.info('Generated budget alert digest', {
      userId,
      alertCount: alerts.length,
      critical: digest.summary.critical,
    });

    return digest;
  }
}
