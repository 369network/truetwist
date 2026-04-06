export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { getAlerts, markAlertsRead, markAllAlertsRead, getAlertSummary } from '@/lib/competitors/alert-service';
import { alertQuerySchema, markAlertsReadSchema } from '@/lib/competitors/validations';

// GET /api/v1/competitors/alerts?businessId=xxx&alertType=viral_post&unreadOnly=true&limit=50&offset=0
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    const businessId = request.nextUrl.searchParams.get('businessId');

    if (!businessId) {
      throw Errors.badRequest('businessId query parameter is required');
    }

    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: auth.sub },
    });
    if (!business) {
      throw Errors.notFound('Business');
    }

    const queryResult = alertQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!queryResult.success) {
      throw Errors.validation(queryResult.error.flatten().fieldErrors);
    }

    const [alertsData, summary] = await Promise.all([
      getAlerts(businessId, queryResult.data),
      getAlertSummary(businessId),
    ]);

    return NextResponse.json({
      data: alertsData.alerts,
      total: alertsData.total,
      summary,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/competitors/alerts (mark alerts as read)
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    const body = await request.json();

    // Handle "mark all read" for a business
    if (body.markAllRead && body.businessId) {
      const business = await prisma.business.findFirst({
        where: { id: body.businessId, userId: auth.sub },
      });
      if (!business) {
        throw Errors.notFound('Business');
      }

      const count = await markAllAlertsRead(body.businessId);
      return NextResponse.json({ data: { markedRead: count } });
    }

    // Handle marking specific alerts as read
    const result = markAlertsReadSchema.safeParse(body);
    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const count = await markAlertsRead(result.data.alertIds);
    return NextResponse.json({ data: { markedRead: count } });
  } catch (error) {
    return errorResponse(error);
  }
}
