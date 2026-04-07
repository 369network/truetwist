export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { redis } from "@/lib/redis";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse, Errors } from "@/lib/errors";
import { initiateShopifyOAuth } from "@/lib/integrations/shopify-connector";
import { z } from "zod";

const connectSchema = z.object({
  shop: z.string().min(1, "Shop domain is required"),
  businessId: z.string().uuid("Invalid business ID"),
});

// POST /api/v1/integrations/shopify/connect — Initiate Shopify OAuth
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = connectSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { shop, businessId } = result.data;

    const state = crypto.randomBytes(32).toString("hex");

    await redis.setex(
      `shopify_oauth_state:${state}`,
      600,
      JSON.stringify({ userId: user.sub, businessId, shop })
    );

    const { authorizationUrl } = initiateShopifyOAuth(shop, state);

    return NextResponse.json({
      data: { authorizationUrl, state },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
