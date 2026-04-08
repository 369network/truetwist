export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse } from "@/lib/errors";

// GET /api/v1/ads/dashboard/insights — AI-powered budget recommendations
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);

    const businesses = await prisma.business.findMany({
      where: { userId: user.sub },
      select: { id: true },
    });
    const businessIds = businesses.map((b) => b.id);

    const startDate = new Date(Date.now() - 30 * 86400000);

    // Fetch recent campaign performance
    const campaigns = await prisma.adCampaign.findMany({
      where: {
        adAccount: { businessId: { in: businessIds } },
        status: "active",
      },
      include: {
        metrics: {
          where: { date: { gte: startDate } },
          orderBy: { date: "desc" },
        },
      },
    });

    const insights: Array<{
      type: string;
      priority: "high" | "medium" | "low";
      title: string;
      description: string;
      impact: string;
      action: string;
      campaignId?: string;
      campaignName?: string;
    }> = [];

    for (const campaign of campaigns) {
      const metrics = campaign.metrics;
      if (metrics.length < 3) continue;

      const totalSpend = metrics.reduce((s, m) => s + m.spend, 0);
      const totalRevenue = metrics.reduce((s, m) => s + m.revenue, 0);
      const totalClicks = metrics.reduce((s, m) => s + m.clicks, 0);
      const totalImpressions = metrics.reduce((s, m) => s + m.impressions, 0);
      const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      // High ROAS — suggest scaling budget
      if (roas > 3) {
        insights.push({
          type: "scale_budget",
          priority: "high",
          title: `Scale "${campaign.name}" budget`,
          description: `This campaign has a ${roas.toFixed(1)}x ROAS over the last 30 days. Increasing budget could drive more revenue.`,
          impact: `Estimated +$${((totalRevenue / metrics.length) * 0.3).toFixed(0)}/day additional revenue`,
          action: "Increase daily budget by 20-30%",
          campaignId: campaign.id,
          campaignName: campaign.name,
        });
      }

      // Low ROAS — suggest optimization
      if (roas < 1 && totalSpend > 50) {
        insights.push({
          type: "optimize_campaign",
          priority: "high",
          title: `Optimize or pause "${campaign.name}"`,
          description: `ROAS is ${roas.toFixed(2)}x — you're spending more than you're earning. Consider narrowing targeting or refreshing creatives.`,
          impact: `Save ~$${(totalSpend / metrics.length).toFixed(0)}/day`,
          action: "Review audience targeting and ad creatives",
          campaignId: campaign.id,
          campaignName: campaign.name,
        });
      }

      // Low CTR — creative fatigue
      if (ctr < 0.5 && totalImpressions > 1000) {
        insights.push({
          type: "creative_fatigue",
          priority: "medium",
          title: `Refresh creatives for "${campaign.name}"`,
          description: `CTR is ${ctr.toFixed(2)}% which suggests ad fatigue. New creatives could improve performance.`,
          impact: "Potential 2-3x CTR improvement",
          action: "Generate new ad creatives with AI",
          campaignId: campaign.id,
          campaignName: campaign.name,
        });
      }
    }

    // Cross-platform budget allocation recommendation
    const platformPerformance: Record<string, { spend: number; revenue: number }> = {};
    for (const campaign of campaigns) {
      const p = campaign.platform;
      if (!platformPerformance[p]) platformPerformance[p] = { spend: 0, revenue: 0 };
      for (const m of campaign.metrics) {
        platformPerformance[p].spend += m.spend;
        platformPerformance[p].revenue += m.revenue;
      }
    }

    const platforms = Object.entries(platformPerformance);
    if (platforms.length > 1) {
      const sorted = platforms
        .map(([platform, data]) => ({
          platform,
          roas: data.spend > 0 ? data.revenue / data.spend : 0,
          spend: data.spend,
        }))
        .sort((a, b) => b.roas - a.roas);

      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      if (best.roas > worst.roas * 2 && worst.spend > 100) {
        insights.push({
          type: "reallocate_budget",
          priority: "high",
          title: `Shift budget from ${worst.platform} to ${best.platform}`,
          description: `${best.platform} has ${best.roas.toFixed(1)}x ROAS vs ${worst.platform}'s ${worst.roas.toFixed(1)}x. Reallocating budget could improve overall returns.`,
          impact: `Estimated ${((best.roas - worst.roas) * worst.spend * 0.3).toFixed(0)} additional revenue`,
          action: `Move 20-30% of ${worst.platform} budget to ${best.platform}`,
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({
      data: {
        insights,
        platformPerformance: Object.fromEntries(
          platforms.map(([p, d]) => [p, { ...d, roas: d.spend > 0 ? d.revenue / d.spend : 0 }])
        ),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
