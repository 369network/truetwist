export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse } from "@/lib/errors";

// GET /api/v1/ads/dashboard/overview — Aggregate ad spend, ROAS, and campaign summary
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";

    const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[range] || 30;
    const startDate = new Date(Date.now() - days * 86400000);

    // Fetch ad metric snapshots for user's ad accounts
    const adAccounts = await prisma.adAccount.findMany({
      where: { businessId: { in: await getUserBusinessIds(user.sub) } },
      select: { id: true, platform: true, name: true },
    });

    const accountIds = adAccounts.map((a) => a.id);

    const snapshots = await prisma.adMetricSnapshot.findMany({
      where: {
        campaign: { adAccountId: { in: accountIds } },
        date: { gte: startDate },
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            platform: true,
            objective: true,
            dailyBudgetCents: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // Aggregate totals
    let totalSpend = 0;
    let totalRevenue = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    const campaignMap = new Map<
      string,
      {
        id: string;
        name: string;
        status: string;
        platform: string;
        objective: string;
        spend: number;
        revenue: number;
        impressions: number;
        clicks: number;
        conversions: number;
        dailyBudgetCents: number;
        sparkline: number[];
      }
    >();

    const platformBreakdown: Record<
      string,
      { spend: number; revenue: number; impressions: number; clicks: number; conversions: number }
    > = {};

    for (const snap of snapshots) {
      const c = snap.campaign;
      totalSpend += snap.spend;
      totalRevenue += snap.revenue;
      totalImpressions += snap.impressions;
      totalClicks += snap.clicks;
      totalConversions += snap.conversions;

      // Campaign aggregation
      if (!campaignMap.has(c.id)) {
        campaignMap.set(c.id, {
          id: c.id,
          name: c.name,
          status: c.status,
          platform: c.platform,
          objective: c.objective,
          spend: 0,
          revenue: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          dailyBudgetCents: c.dailyBudgetCents,
          sparkline: [],
        });
      }
      const entry = campaignMap.get(c.id)!;
      entry.spend += snap.spend;
      entry.revenue += snap.revenue;
      entry.impressions += snap.impressions;
      entry.clicks += snap.clicks;
      entry.conversions += snap.conversions;
      entry.sparkline.push(snap.spend);

      // Platform breakdown
      if (!platformBreakdown[c.platform]) {
        platformBreakdown[c.platform] = { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 };
      }
      platformBreakdown[c.platform].spend += snap.spend;
      platformBreakdown[c.platform].revenue += snap.revenue;
      platformBreakdown[c.platform].impressions += snap.impressions;
      platformBreakdown[c.platform].clicks += snap.clicks;
      platformBreakdown[c.platform].conversions += snap.conversions;
    }

    const campaigns = Array.from(campaignMap.values()).map((c) => ({
      ...c,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      roas: c.spend > 0 ? c.revenue / c.spend : 0,
      conversionRate: c.clicks > 0 ? (c.conversions / c.clicks) * 100 : 0,
    }));

    // Build daily spend/ROAS trend
    const dailyTrend = buildDailyTrend(snapshots, days);

    // Check for anomalies
    const anomalies = detectAnomalies(campaigns, dailyTrend);

    return NextResponse.json({
      data: {
        summary: {
          totalSpend,
          totalRevenue,
          totalImpressions,
          totalClicks,
          totalConversions,
          overallRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
          avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
          avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          activeCampaigns: campaigns.filter((c) => c.status === "active").length,
        },
        campaigns: campaigns.sort((a, b) => b.spend - a.spend).slice(0, 20),
        platformBreakdown,
        dailyTrend,
        anomalies,
        dateRange: { start: startDate.toISOString(), end: new Date().toISOString(), days },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function getUserBusinessIds(userId: string): Promise<string[]> {
  const businesses = await prisma.business.findMany({
    where: { userId },
    select: { id: true },
  });
  return businesses.map((b) => b.id);
}

function buildDailyTrend(
  snapshots: Array<{ date: Date; spend: number; revenue: number; impressions: number; clicks: number }>,
  days: number
) {
  const buckets: Record<string, { spend: number; revenue: number; impressions: number; clicks: number }> = {};

  for (const s of snapshots) {
    const key = new Date(s.date).toISOString().slice(0, 10);
    if (!buckets[key]) buckets[key] = { spend: 0, revenue: 0, impressions: 0, clicks: 0 };
    buckets[key].spend += s.spend;
    buckets[key].revenue += s.revenue;
    buckets[key].impressions += s.impressions;
    buckets[key].clicks += s.clicks;
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([date, data]) => ({
      date,
      spend: data.spend,
      revenue: data.revenue,
      roas: data.spend > 0 ? data.revenue / data.spend : 0,
      impressions: data.impressions,
      clicks: data.clicks,
    }));
}

interface CampaignSummary {
  name: string;
  roas: number;
  spend: number;
  cpc: number;
  dailyBudgetCents: number;
}

function detectAnomalies(
  campaigns: CampaignSummary[],
  dailyTrend: Array<{ date: string; roas: number; spend: number }>
) {
  const alerts: Array<{ type: string; severity: "warning" | "critical"; message: string }> = [];

  // CPC spike detection
  for (const c of campaigns) {
    if (c.roas < 1 && c.spend > 0) {
      alerts.push({
        type: "roas_drop",
        severity: "critical",
        message: `${c.name} has ROAS below 1.0x (${c.roas.toFixed(2)}x) — spending more than earning`,
      });
    }
  }

  // Budget exhaustion detection
  for (const c of campaigns) {
    if (c.dailyBudgetCents > 0 && c.spend > (c.dailyBudgetCents / 100) * 0.9) {
      alerts.push({
        type: "budget_exhaustion",
        severity: "warning",
        message: `${c.name} is near daily budget limit`,
      });
    }
  }

  // Sudden spend change detection
  if (dailyTrend.length >= 3) {
    const recent = dailyTrend[dailyTrend.length - 1];
    const previous = dailyTrend[dailyTrend.length - 2];
    if (previous.spend > 0 && recent.spend / previous.spend > 1.5) {
      alerts.push({
        type: "spend_spike",
        severity: "warning",
        message: `Daily spend increased ${((recent.spend / previous.spend - 1) * 100).toFixed(0)}% vs yesterday`,
      });
    }
  }

  return alerts;
}
