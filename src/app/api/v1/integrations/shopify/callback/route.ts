export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { errorResponse, Errors } from "@/lib/errors";
import {
  exchangeShopifyCode,
  createShopifyConnection,
  registerShopifyWebhooks,
} from "@/lib/integrations/shopify-connector";

// GET /api/v1/integrations/shopify/callback — Shopify OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const shop = searchParams.get("shop");

    if (!code || !state || !shop) {
      throw Errors.badRequest("Missing code, state, or shop parameter");
    }

    const storedState = await redis.get(`shopify_oauth_state:${state}`);
    if (!storedState) {
      throw Errors.unauthorized("Invalid or expired OAuth state");
    }

    const { userId, businessId } = JSON.parse(storedState);

    // Clean up state
    await redis.del(`shopify_oauth_state:${state}`);

    // Exchange code for token
    const tokenData = await exchangeShopifyCode(shop, code);

    // Store connection
    const connection = await createShopifyConnection(
      businessId,
      shop.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      tokenData.access_token,
      tokenData.scope
    );

    // Register webhooks
    try {
      await registerShopifyWebhooks(connection.id);
    } catch {
      // Non-fatal: webhooks can be registered later
    }

    // Redirect to dashboard with success
    const redirectUrl = new URL(
      "/dashboard/integrations?shopify=connected",
      process.env.NEXT_PUBLIC_APP_URL
    );
    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    return errorResponse(error);
  }
}
