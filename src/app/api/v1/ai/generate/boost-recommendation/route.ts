export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse } from "@/lib/errors";
import { CrossChannelService } from "@/lib/analytics/cross-channel-service";

const crossChannel = new CrossChannelService();

// POST /api/v1/ai/generate/boost-recommendation — AI recommends posts to boost with budget estimate
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    const businessId = body.businessId as string | undefined;
    const limit = Math.min(Math.max(body.limit || 5, 1), 20);

    const recommendations = await crossChannel.getBoostRecommendations(
      user.sub,
      limit,
      businessId
    );

    return NextResponse.json({
      data: {
        recommendations,
        count: recommendations.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
