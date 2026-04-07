export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse } from "@/lib/errors";

// GET /api/v1/ads/dashboard/campaigns — List campaigns with metrics
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const range = searchParams.get("range") || "30d";
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");
    const sort = searchParams.get("sort") || "spend";
    const order = searchParams.get("order") || "desc";

    const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[range] || 30;
    const startDate = new Date(Date.now() - days * 86400000);

    const businesses = await prisma.business.findMany({
      where: { userId: user.sub },
      select: { id: true },
    });
    const businessIds = businesses.map((b) => b.id);

    const campaignWhere: Record<string, unknown> = {
      adAccount: { businessId: { in: businessIds } },
    };
    if (platform) campaignWhere.platform = platform;
    if (status) campaignWhere.status = status;

    const campaigns = await prisma.adCampaign.findMany({
      where: campaignWhere,
      include: {
        adAccount: { select: { name: true, platform: true } },
        metrics: {
          where: { date: { gte: startDate } },
          orderBy: { date: "asc" },
        },
      },
    });

    const results = campaigns.map((campaign) => {
      const metrics = campaign.metrics;
      const totals = metrics.reduce(
        (acc, m) => ({
          spend: acc.spend + m.spend,
          revenue: acc.revenue + m.revenue,
          impressions: acc.impressions + m.impressions,
          clicks: acc.clicks + m.clicks,
          conversions: acc.conversions + m.conversions,
        }),
        { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 }
      );

      return {
        id: campaign.id,
        name: campaign.name,
        platform: campaign.platform,
        status: campaign.status,
        objective: campaign.objective,
        dailyBudgetCents: campaign.dailyBudgetCents,
        accountName: campaign.adAccount.name,
        ...totals,
        roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0,
        dailyMetrics: metrics.map((m) => ({
          date: m.date,
          spend: m.spend,
          revenue: m.revenue,
          impressions: m.impressions,
          clicks: m.clicks,
          conversions: m.conversions,
          roas: m.spend > 0 ? m.revenue / m.spend : 0,
        })),
      };
    });

    // Sort
    const sortKey = sort as keyof (typeof results)[0];
    results.sort((a, b) => {
      const aVal = (a[sortKey] as number) || 0;
      const bVal = (b[sortKey] as number) || 0;
      return order === "desc" ? bVal - aVal : aVal - bVal;
    });

    return NextResponse.json({ data: results });
  } catch (error) {
    return errorResponse(error);
  }
}
