export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse, Errors } from "@/lib/errors";
import { decryptTokenFromDb } from "@/lib/ads/encryption";

// POST /api/v1/ads/accounts/[id]/sync - Trigger manual sync of ad account metrics
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getAuthUser(request);
    const { id } = await params;

    // Check if adAccount model is available
    if (!("adAccount" in prisma)) {
      throw Errors.badRequest("Ad accounts feature not fully configured");
    }

    // Get ad account with encrypted token
    const adAccount = await (prisma as any).adAccount.findFirst({
      where: {
        id,
        userId: user.sub,
        status: "active",
      },
      select: {
        id: true,
        platform: true,
        platformAccountId: true,
        encryptedToken: true,
        tokenIv: true,
        accountName: true,
        metadata: true,
      },
    });

    if (!adAccount) {
      throw Errors.notFound("Active ad account not found");
    }

    // Decrypt token
    let accessToken;
    try {
      accessToken = decryptTokenFromDb(
        adAccount.encryptedToken,
        adAccount.tokenIv,
      );
    } catch (error) {
      console.error("Failed to decrypt token:", error);
      throw Errors.badRequest("Failed to decrypt access token");
    }

    // Update lastSyncedAt immediately
    await (prisma as any).adAccount.update({
      where: { id },
      data: { lastSyncedAt: new Date() },
    });

    // Based on platform, sync metrics
    let syncResult;
    switch (adAccount.platform) {
      case "meta_ads":
        syncResult = await syncMetaAdsMetrics(
          adAccount.platformAccountId,
          accessToken,
          adAccount.id,
        );
        break;
      case "google_ads":
        syncResult = await syncGoogleAdsMetrics(
          adAccount.platformAccountId,
          accessToken,
          adAccount.id,
        );
        break;
      case "tiktok_ads":
        syncResult = await syncTikTokAdsMetrics(
          adAccount.platformAccountId,
          accessToken,
          adAccount.id,
        );
        break;
      case "linkedin_ads":
        syncResult = await syncLinkedInAdsMetrics(
          adAccount.platformAccountId,
          accessToken,
          adAccount.id,
        );
        break;
      default:
        throw Errors.badRequest(`Unsupported platform: ${adAccount.platform}`);
    }

    return NextResponse.json({
      data: {
        accountId: adAccount.id,
        accountName: adAccount.accountName,
        platform: adAccount.platform,
        syncTriggered: true,
        message: "Sync initiated",
        details: syncResult,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// Mock sync functions - in production, these would make actual API calls
async function syncMetaAdsMetrics(
  accountId: string,
  accessToken: string,
  dbAccountId: string,
): Promise<{ status: string; message: string }> {
  console.log(`Syncing Meta Ads account ${accountId}`);

  // In production: Make Graph API calls to fetch campaigns and metrics
  // For now, return mock response
  return {
    status: "queued",
    message: "Meta Ads sync queued. Metrics will be updated shortly.",
  };
}

async function syncGoogleAdsMetrics(
  accountId: string,
  accessToken: string,
  dbAccountId: string,
): Promise<{ status: string; message: string }> {
  console.log(`Syncing Google Ads account ${accountId}`);
  return {
    status: "queued",
    message: "Google Ads sync queued. Metrics will be updated shortly.",
  };
}

async function syncTikTokAdsMetrics(
  accountId: string,
  accessToken: string,
  dbAccountId: string,
): Promise<{ status: string; message: string }> {
  console.log(`Syncing TikTok Ads account ${accountId}`);
  return {
    status: "queued",
    message: "TikTok Ads sync queued. Metrics will be updated shortly.",
  };
}

async function syncLinkedInAdsMetrics(
  accountId: string,
  accessToken: string,
  dbAccountId: string,
): Promise<{ status: string; message: string }> {
  console.log(`Syncing LinkedIn Ads account ${accountId}`);
  return {
    status: "queued",
    message: "LinkedIn Ads sync queued. Metrics will be updated shortly.",
  };
}
