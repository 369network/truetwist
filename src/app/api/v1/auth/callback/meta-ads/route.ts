export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptTokenForDb } from "@/lib/ads/encryption";
import { errorResponse, Errors } from "@/lib/errors";
import { auditFromRequest, AuditActions } from "@/lib/audit";

// GET /api/v1/auth/callback/meta-ads - Meta Ads OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorReason = searchParams.get("error_reason");
    const errorDescription = searchParams.get("error_description");

    // Handle OAuth errors
    if (error) {
      console.error("Meta Ads OAuth error:", {
        error,
        errorReason,
        errorDescription,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/ads?error=${encodeURIComponent(errorDescription || errorReason || error)}`,
      );
    }

    if (!code || !state) {
      throw Errors.badRequest("Missing code or state parameter");
    }

    // Decode and verify state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, "base64").toString());
    } catch {
      throw Errors.badRequest("Invalid state parameter");
    }

    const { userId, businessId, timestamp } = stateData;

    // Verify state isn't too old (5 minutes)
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      throw Errors.badRequest("OAuth state expired");
    }

    // Verify user and business exist
    const [user, business] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true },
      }),
      prisma.business.findFirst({
        where: { id: businessId, userId },
        select: { id: true, name: true },
      }),
    ]);

    if (!user || !business) {
      throw Errors.notFound("User or business not found");
    }

    // Exchange code for access token
    const clientId = process.env.META_ADS_CLIENT_ID;
    const clientSecret = process.env.META_ADS_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/auth/callback/meta-ads`;

    if (!clientId || !clientSecret) {
      throw Errors.badRequest("Meta Ads integration not configured");
    }

    const tokenResponse = await fetch(
      "https://graph.facebook.com/v21.0/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Meta Ads token exchange failed:", errorText);
      throw Errors.badRequest("Failed to exchange code for access token");
    }

    const tokenData = await tokenResponse.json();
    const {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
    } = tokenData;

    if (!accessToken) {
      throw Errors.badRequest("No access token in response");
    }

    // Get long-lived token (60 days)
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${accessToken}`,
    );

    let longLivedToken = accessToken;
    let tokenExpiresAt = new Date(Date.now() + (expiresIn || 3600) * 1000);

    if (longLivedResponse.ok) {
      const longLivedData = await longLivedResponse.json();
      if (longLivedData.access_token) {
        longLivedToken = longLivedData.access_token;
        tokenExpiresAt = new Date(
          Date.now() + (longLivedData.expires_in || 5184000) * 1000,
        ); // 60 days default
      }
    }

    // Get ad accounts and user info from Meta
    const accountsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name&access_token=${longLivedToken}`,
    );

    if (!accountsResponse.ok) {
      console.error(
        "Failed to fetch ad accounts:",
        await accountsResponse.text(),
      );
      // Still proceed with connection, user can sync accounts manually
    }

    const accountsData = await accountsResponse.json();
    const adAccounts = accountsData.data || [];

    // Encrypt token for storage
    const { encryptedToken, iv } = encryptTokenForDb(longLivedToken);

    // Store or update ad accounts
    const createdAccounts = [];

    // Try to save ad accounts if Prisma model is available
    try {
      // Check if adAccount model exists in Prisma client
      if ("adAccount" in prisma) {
        for (const account of adAccounts) {
          if (account.account_status === 1) {
            // ACTIVE status
            try {
              const adAccount = await (prisma as any).adAccount.upsert({
                where: {
                  userId_businessId_platform_platformAccountId: {
                    userId,
                    businessId,
                    platform: "meta_ads",
                    platformAccountId: account.id,
                  },
                },
                update: {
                  accountName: account.name,
                  accountCurrency: account.currency,
                  timezone: account.timezone_name,
                  encryptedToken,
                  tokenIv: iv,
                  tokenExpiresAt,
                  status: "active",
                  lastSyncedAt: new Date(),
                  metadata: {
                    accountId: account.account_id,
                    accountStatus: account.account_status,
                    ...account,
                  },
                },
                create: {
                  userId,
                  businessId,
                  platform: "meta_ads",
                  platformAccountId: account.id,
                  accountName: account.name,
                  accountCurrency: account.currency,
                  timezone: account.timezone_name,
                  encryptedToken,
                  tokenIv: iv,
                  tokenExpiresAt,
                  status: "active",
                  metadata: {
                    accountId: account.account_id,
                    accountStatus: account.account_status,
                    ...account,
                  },
                },
              });

              createdAccounts.push(adAccount);
            } catch (error) {
              console.error(`Failed to save ad account ${account.id}:`, error);
            }
          }
        }
      } else {
        console.warn(
          "AdAccount model not available in Prisma client. Run migrations first.",
        );
      }
    } catch (error) {
      console.error("Failed to access adAccount model:", error);
    }

    // Audit log
    await auditFromRequest(request, {
      userId,
      action: AuditActions.AD_ACCOUNT_CONNECTED,
      resource: "ad_account",
      resourceId: createdAccounts[0]?.id || "unknown",
      metadata: {
        platform: "meta_ads",
        accountsConnected: createdAccounts.length,
        businessId,
      },
    });

    // Redirect to success page
    const redirectUrl = new URL(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/ads`,
    );
    redirectUrl.searchParams.set("success", "true");
    redirectUrl.searchParams.set("accounts", createdAccounts.length.toString());
    if (createdAccounts.length === 0) {
      redirectUrl.searchParams.set(
        "warning",
        "No active ad accounts found or database not ready",
      );
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Meta Ads callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/ads?error=${encodeURIComponent(error instanceof Error ? error.message : "Authentication failed")}`,
    );
  }
}
