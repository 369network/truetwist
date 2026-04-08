export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse } from "@/lib/errors";

// GET /api/v1/ads/dashboard/[campaignId]/metrics?range=7d|30d|90d
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const user = getAuthUser(request);
    const { campaignId } = await params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";

    const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[range] || 30;
    const startDate = new Date(Date.now() - days * 86400000);

    // Verify campaign belongs to user
    const campaign = await prisma.adCampaign.findFirst({
      where: {
        id: campaignId,
        adAccount: {
          business: { userId: user.sub },
        },
      },
      include: {
        adAccount: { select: { name: true, platform: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Campaign not found" } }, { status: 404 });
    }

    const metrics = await prisma.adMetricSnapshot.findMany({
      where: {
        campaignId,
        date: { gte: startDate },
      },
      orderBy: { date: "asc" },
    });

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

    return NextResponse.json({
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          platform: campaign.platform,
          status: campaign.status,
          objective: campaign.objective,
          dailyBudgetCents: campaign.dailyBudgetCents,
          accountName: campaign.adAccount.name,
        },
        summary: {
          ...totals,
          roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
          cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
          ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
          conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0,
        },
        dailyMetrics: metrics.map((m) => ({
          date: m.date,
          spend: m.spend,
          revenue: m.revenue,
          impressions: m.impressions,
          clicks: m.clicks,
          conversions: m.conversions,
          roas: m.spend > 0 ? m.revenue / m.spend : 0,
          cpc: m.clicks > 0 ? m.spend / m.clicks : 0,
          ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
        })),
        dateRange: { start: startDate.toISOString(), end: new Date().toISOString(), days },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
