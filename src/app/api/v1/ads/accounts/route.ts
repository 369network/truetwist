export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse, Errors } from "@/lib/errors";
import { z } from "zod";

const createAccountSchema = z.object({
  businessId: z.string().uuid(),
  platform: z.enum([
    "meta_ads",
    "google_ads",
    "tiktok_ads",
    "linkedin_ads",
  ] as const),
  platformAccountId: z.string(),
  accountName: z.string().optional(),
  accountCurrency: z.string().optional(),
  timezone: z.string().optional(),
  encryptedToken: z.string(),
  tokenIv: z.string(),
  tokenExpiresAt: z.string().datetime().optional(),
  metadata: z.unknown().optional(),
});

const updateAccountSchema = z.object({
  accountName: z.string().optional(),
  status: z
    .enum(["active", "disconnected", "revoked", "error"] as const)
    .optional(),
  metadata: z.unknown().optional(),
});

// GET /api/v1/ads/accounts - List connected ad accounts
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const businessId = searchParams.get("businessId");
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(
      parseInt(searchParams.get("pageSize") || "20", 10),
      100,
    );

    const where: Record<string, unknown> = { userId: user.sub };
    if (businessId) {
      // Verify user owns the business
      const business = await prisma.business.findFirst({
        where: { id: businessId, userId: user.sub },
        select: { id: true },
      });
      if (!business) {
        throw Errors.notFound("Business not found or access denied");
      }
      where.businessId = businessId;
    }
    if (platform) where.platform = platform;
    if (status) where.status = status;

    // Check if adAccount model is available
    if (!("adAccount" in prisma)) {
      return NextResponse.json({
        data: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
        warning:
          "Ad accounts feature not fully configured. Run database migrations.",
      });
    }

    const [accounts, total] = await Promise.all([
      (prisma as any).adAccount.findMany({
        where,
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
          business: { select: { id: true, name: true } },
          _count: { select: { campaigns: true, snapshots: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      (prisma as any).adAccount.count({ where }),
    ]);

    return NextResponse.json({
      data: accounts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/ads/accounts - Create/connect ad account (manual)
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = createAccountSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const {
      businessId,
      platform,
      platformAccountId,
      accountName,
      accountCurrency,
      timezone,
      encryptedToken,
      tokenIv,
      tokenExpiresAt,
      metadata,
    } = result.data;

    // Verify user owns the business
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: user.sub },
      select: { id: true, name: true },
    });

    if (!business) {
      throw Errors.notFound("Business not found or access denied");
    }

    // Check if adAccount model is available
    if (!("adAccount" in prisma)) {
      throw Errors.badRequest(
        "Ad accounts feature not fully configured. Run database migrations first.",
      );
    }

    // Create ad account
    const adAccount = await (prisma as any).adAccount.create({
      data: {
        userId: user.sub,
        businessId,
        platform,
        platformAccountId,
        accountName,
        accountCurrency,
        timezone: timezone || "UTC",
        encryptedToken,
        tokenIv,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
        status: "active",
        metadata: metadata || {},
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
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        data: adAccount,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
