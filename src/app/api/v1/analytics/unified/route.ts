export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse } from "@/lib/errors";
import { CrossChannelService } from "@/lib/analytics/cross-channel-service";

const crossChannel = new CrossChannelService();

// GET /api/v1/analytics/unified — Combined organic + paid analytics by time range
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const range = searchParams.get("range") || "30d";
    const businessId = searchParams.get("businessId") || undefined;

    const daysMap: Record<string, number> = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 };
    const days = daysMap[range] || 30;

    const metrics = await crossChannel.getUnifiedAnalytics(user.sub, days, businessId);

    return NextResponse.json({ data: metrics });
  } catch (error) {
    return errorResponse(error);
  }
}
