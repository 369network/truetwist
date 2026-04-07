export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse, Errors } from "@/lib/errors";

// GET /api/v1/integrations/mls/listings — List synced MLS listings
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      throw Errors.badRequest("businessId query parameter is required");
    }

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: user.sub },
    });
    if (!business) {
      throw Errors.notFound("Business");
    }

    const connections = await prisma.mlsConnection.findMany({
      where: { businessId },
      include: {
        listings: {
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    const listings = connections.flatMap((conn) =>
      conn.listings.map((l) => ({
        ...l,
        feedUrl: conn.feedUrl,
        connectionId: conn.id,
      }))
    );

    return NextResponse.json({ data: listings });
  } catch (error) {
    return errorResponse(error);
  }
}
