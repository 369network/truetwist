export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse } from "@/lib/errors";
import { BudgetAlertService } from "@/lib/analytics/budget-alert-service";

const alertService = new BudgetAlertService();

// GET /api/v1/ads/alerts — Smart budget alerts for ad campaigns
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const businessId = searchParams.get("businessId") || undefined;

    const digest = await alertService.generateAlerts(user.sub, businessId);

    return NextResponse.json({ data: digest });
  } catch (error) {
    return errorResponse(error);
  }
}
