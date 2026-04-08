export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse, Errors } from "@/lib/errors";
import { z } from "zod";

const connectSchema = z.object({
  businessId: z.string().uuid(),
  redirectUri: z.string().url().optional(),
});

// GET /api/v1/ads/accounts/connect/meta - Initiate Meta Ads OAuth flow
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const businessId = searchParams.get("businessId");
    const redirectUri =
      searchParams.get("redirectUri") ||
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/ads`;

    if (!businessId) {
      throw Errors.badRequest("businessId is required");
    }

    // Verify user owns the business
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: user.sub },
      select: { id: true, name: true },
    });

    if (!business) {
      throw Errors.notFound("Business not found or access denied");
    }

    // Check Meta Ads client ID
    const clientId = process.env.META_ADS_CLIENT_ID;
    if (!clientId) {
      throw Errors.badRequest("Meta Ads integration not configured");
    }

    // Generate state parameter for OAuth security
    const state = Buffer.from(
      JSON.stringify({
        userId: user.sub,
        businessId,
        timestamp: Date.now(),
      }),
    ).toString("base64");

    // Meta Ads OAuth scopes
    const scopes = [
      "ads_management",
      "ads_read",
      "business_management",
      "pages_read_engagement",
      "pages_show_list",
    ].join(",");

    // Construct OAuth URL
    const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    oauthUrl.searchParams.set("client_id", clientId);
    oauthUrl.searchParams.set(
      "redirect_uri",
      `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/auth/callback/meta-ads`,
    );
    oauthUrl.searchParams.set("state", state);
    oauthUrl.searchParams.set("scope", scopes);
    oauthUrl.searchParams.set("response_type", "code");

    // Store state in session or database for verification
    // For now, we'll return it in the response
    // In production, store in Redis or database with expiry

    return NextResponse.json({
      data: {
        oauthUrl: oauthUrl.toString(),
        state,
        business: { id: business.id, name: business.name },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/ads/accounts/connect/meta - Alternative with JSON body
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = connectSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { businessId, redirectUri } = result.data;

    // Verify user owns the business
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: user.sub },
      select: { id: true, name: true },
    });

    if (!business) {
      throw Errors.notFound("Business not found or access denied");
    }

    // Check Meta Ads client ID
    const clientId = process.env.META_ADS_CLIENT_ID;
    if (!clientId) {
      throw Errors.badRequest("Meta Ads integration not configured");
    }

    // Generate state parameter for OAuth security
    const state = Buffer.from(
      JSON.stringify({
        userId: user.sub,
        businessId,
        timestamp: Date.now(),
      }),
    ).toString("base64");

    // Meta Ads OAuth scopes
    const scopes = [
      "ads_management",
      "ads_read",
      "business_management",
      "pages_read_engagement",
      "pages_show_list",
    ].join(",");

    // Construct OAuth URL
    const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    oauthUrl.searchParams.set("client_id", clientId);
    oauthUrl.searchParams.set(
      "redirect_uri",
      `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/auth/callback/meta-ads`,
    );
    oauthUrl.searchParams.set("state", state);
    oauthUrl.searchParams.set("scope", scopes);
    oauthUrl.searchParams.set("response_type", "code");

    return NextResponse.json({
      data: {
        oauthUrl: oauthUrl.toString(),
        state,
        business: { id: business.id, name: business.name },
        redirectUri:
          redirectUri || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/ads`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
