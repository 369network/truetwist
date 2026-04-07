export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse, Errors } from "@/lib/errors";

// GET /api/v1/integrations/shopify/products — List synced products
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

    const connections = await prisma.shopifyConnection.findMany({
      where: { businessId },
      include: {
        products: {
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    const products = connections.flatMap((conn) =>
      conn.products.map((p) => ({
        ...p,
        shopDomain: conn.shopDomain,
        connectionId: conn.id,
      }))
    );

    return NextResponse.json({ data: products });
  } catch (error) {
    return errorResponse(error);
  }
}
