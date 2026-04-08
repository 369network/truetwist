export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse, Errors } from "@/lib/errors";
import { z } from "zod";
import { auditFromRequest, AuditActions } from "@/lib/audit";

const updateAccountSchema = z.object({
  accountName: z.string().optional(),
  status: z
    .enum(["active", "disconnected", "revoked", "error"] as const)
    .optional(),
  metadata: z.unknown().optional(),
});

// GET /api/v1/ads/accounts/[id] - Get ad account details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getAuthUser(request);
    const { id } = await params;

    // Check if adAccount model is available
    if (!("adAccount" in prisma)) {
      throw Errors.notFound("Ad account not found");
    }

    const adAccount = await (prisma as any).adAccount.findFirst({
      where: {
        id,
        userId: user.sub,
      },
      select: {
        id: true,
        businessId: true,
        platform: true,
        platformAccountId: true,
        accountName: true,
        accountCurrency: true,
        timezone: true,
        status: true,
        lastSyncedAt: true,
        syncError: true,
        metadata: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        business: { select: { id: true, name: true } },
        campaigns: {
          select: {
            id: true,
            platformCampaignId: true,
            name: true,
            status: true,
            objective: true,
            dailyBudgetCents: true,
            startDate: true,
            endDate: true,
            lastSyncedAt: true,
            _count: { select: { snapshots: true } },
          },
          orderBy: { lastSyncedAt: "desc" },
          take: 10,
        },
        snapshots: {
          select: {
            id: true,
            date: true,
            impressions: true,
            clicks: true,
            spendCents: true,
            conversions: true,
            conversionValueCents: true,
            ctr: true,
            cpcCents: true,
            roas: true,
          },
          orderBy: { date: "desc" },
          take: 30,
        },
        _count: {
          select: { campaigns: true, snapshots: true },
        },
      },
    });

    if (!adAccount) {
      throw Errors.notFound("Ad account not found");
    }

    return NextResponse.json({
      data: adAccount,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/ads/accounts/[id] - Update ad account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getAuthUser(request);
    const { id } = await params;
    const body = await request.json();
    const result = updateAccountSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    // Check if adAccount model is available
    if (!("adAccount" in prisma)) {
      throw Errors.badRequest("Ad accounts feature not fully configured");
    }

    // Verify user owns the ad account
    const existingAccount = await (prisma as any).adAccount.findFirst({
      where: { id, userId: user.sub },
      select: { id: true, platform: true, platformAccountId: true },
    });

    if (!existingAccount) {
      throw Errors.notFound("Ad account not found");
    }

    const updatedAccount = await (prisma as any).adAccount.update({
      where: { id },
      data: result.data,
      select: {
        id: true,
        businessId: true,
        platform: true,
        platformAccountId: true,
        accountName: true,
        accountCurrency: true,
        timezone: true,
        status: true,
        lastSyncedAt: true,
        syncError: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    await auditFromRequest(request, {
      userId: user.sub,
      action: AuditActions.AD_CAMPAIGN_UPDATED,
      resource: "ad_account",
      resourceId: id,
      metadata: {
        platform: updatedAccount.platform,
        platformAccountId: updatedAccount.platformAccountId,
        updates: Object.keys(result.data),
      },
    });

    return NextResponse.json({
      data: updatedAccount,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/ads/accounts/[id] - Disconnect ad account
export async function DELETE(
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

    // Verify user owns the ad account
    const existingAccount = await (prisma as any).adAccount.findFirst({
      where: { id, userId: user.sub },
      select: {
        id: true,
        platform: true,
        platformAccountId: true,
        accountName: true,
      },
    });

    if (!existingAccount) {
      throw Errors.notFound("Ad account not found");
    }

    // Soft delete by marking as disconnected
    const deletedAccount = await (prisma as any).adAccount.update({
      where: { id },
      data: { status: "disconnected" },
      select: {
        id: true,
        platform: true,
        platformAccountId: true,
        accountName: true,
        status: true,
        updatedAt: true,
      },
    });

    // Audit log
    await auditFromRequest(request, {
      userId: user.sub,
      action: AuditActions.AD_ACCOUNT_DISCONNECTED,
      resource: "ad_account",
      resourceId: id,
      metadata: {
        platform: deletedAccount.platform,
        platformAccountId: deletedAccount.platformAccountId,
        accountName: deletedAccount.accountName,
      },
    });

    return NextResponse.json({
      data: deletedAccount,
      message: "Ad account disconnected successfully",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
