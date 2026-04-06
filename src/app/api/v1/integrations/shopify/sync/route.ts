export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse, Errors } from "@/lib/errors";
import { addShopifySyncJob } from "@/queues";

// POST /api/v1/integrations/shopify/sync — Trigger manual product sync
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      throw Errors.badRequest("connectionId is required");
    }

    const connection = await prisma.shopifyConnection.findUnique({
      where: { id: connectionId },
      include: { business: true },
    });

    if (!connection) {
      throw Errors.notFound("Shopify connection");
    }

    if (connection.business.userId !== user.sub) {
      throw Errors.forbidden("Not authorized to sync this connection");
    }

    if (connection.syncStatus === "syncing") {
      throw Errors.conflict("Sync already in progress");
    }

    await addShopifySyncJob({
      connectionId: connection.id,
      businessId: connection.businessId,
    });

    return NextResponse.json({
      data: { message: "Sync job queued", connectionId: connection.id },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
