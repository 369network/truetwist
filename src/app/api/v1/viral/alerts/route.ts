import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { getUserAlerts } from '@/lib/viral';
import type { TrendAlertType } from '@/lib/viral';

// GET /api/v1/viral/alerts?unread=true&type=niche_match&limit=20
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);

    const { searchParams } = request.nextUrl;
    const alertType = searchParams.get('type') as TrendAlertType | null;
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const result = await getUserAlerts(auth.sub, {
      alertType: alertType ?? undefined,
      unreadOnly,
      limit,
      offset,
    });

    return NextResponse.json({
      data: result.alerts,
      total: result.total,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
