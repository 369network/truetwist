export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { upsertAlertPreferences } from '@/lib/viral';
import { alertPreferencesSchema } from '@/lib/viral/validations';

// GET /api/v1/viral/alerts/preferences
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);

    const prefs = await prisma.trendAlertPreference.findMany({
      where: { userId: auth.sub },
    });

    return NextResponse.json({ data: prefs });
  } catch (error) {
    return errorResponse(error);
  }
}

// PUT /api/v1/viral/alerts/preferences
export async function PUT(request: NextRequest) {
  try {
    const auth = getAuthUser(request);

    const body = await request.json();
    const parsed = alertPreferencesSchema.parse(body);

    const pref = await upsertAlertPreferences(
      auth.sub,
      parsed.businessId ?? null,
      parsed
    );

    return NextResponse.json({ data: pref });
  } catch (error) {
    return errorResponse(error);
  }
}
