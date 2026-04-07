export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { AdAccountManager } from '@/lib/ads/ad-account-manager';
import type { AdPlatform } from '@/lib/ads/types';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getAuthUser(request);
    const { id } = await params;

    const account = await prisma.adAccount.findFirst({
      where: { id, userId: user.sub, status: 'active' },
      include: { campaigns: { where: { status: 'active' } } },
    });

    if (!account) throw Errors.notFound('Ad account');
    if (!account.encryptedAccessToken) {
      throw Errors.badRequest('Ad account not connected — complete OAuth first');
    }

    const platform = account.platform as AdPlatform;
    const { accessToken, refreshed, updatedCredentials } =
      await AdAccountManager.getAccessToken({
        platform,
        platformAccountId: account.platformAccountId,
        accessTokenEncrypted: account.encryptedAccessToken,
        refreshTokenEncrypted: account.encryptedRefreshToken,
        expiresAt: account.tokenExpiresAt,
      });

    if (refreshed && updatedCredentials) {
      await prisma.adAccount.update({
        where: { id },
        data: {
          encryptedAccessToken: updatedCredentials.accessTokenEncrypted,
          encryptedRefreshToken: updatedCredentials.refreshTokenEncrypted,
          tokenExpiresAt: updatedCredentials.expiresAt,
        },
      });
    }

    const adapter = AdAccountManager.getAdapter(platform, account.platformAccountId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const dateRange = { start: yesterday, end: today };

    let syncedCount = 0;

    for (const campaign of account.campaigns) {
      const metrics = await adapter.fetchCampaignMetrics(
        accessToken,
        campaign.platformCampaignId,
        dateRange,
      );

      for (const m of metrics) {
        const metricDate = new Date(m.date);
        metricDate.setHours(0, 0, 0, 0);

        await prisma.adMetricSnapshot.upsert({
          where: {
            adAccountId_campaignId_date: {
              adAccountId: id,
              campaignId: campaign.id,
              date: metricDate,
            },
          },
          update: {
            impressions: m.impressions,
            clicks: m.clicks,
            spendCents: Math.round(m.spend * 100),
            conversions: m.conversions,
            roas: m.returnOnAdSpend,
            ctr: m.clickThroughRate,
            cpcCents: Math.round(m.costPerClick * 100),
            platformData: m.platformSpecific ?? {},
          },
          create: {
            adAccountId: id,
            campaignId: campaign.id,
            date: metricDate,
            impressions: m.impressions,
            clicks: m.clicks,
            spendCents: Math.round(m.spend * 100),
            conversions: m.conversions,
            roas: m.returnOnAdSpend,
            ctr: m.clickThroughRate,
            cpcCents: Math.round(m.costPerClick * 100),
            platformData: m.platformSpecific ?? {},
          },
        });
        syncedCount++;
      }
    }

    await prisma.adAccount.update({
      where: { id },
      data: { lastSyncedAt: new Date() },
    });

    await prisma.adAuditLog.create({
      data: {
        userId: user.sub,
        adAccountId: id,
        action: 'metrics_synced',
        entityType: 'ad_account',
        entityId: id,
        details: { campaignsSynced: account.campaigns.length, metricsUpserted: syncedCount },
      },
    });

    return NextResponse.json({ data: { synced: true, metricsUpserted: syncedCount, lastSyncedAt: new Date() } });
  } catch (error) {
    return errorResponse(error);
  }
}
