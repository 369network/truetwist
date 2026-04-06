import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { markAlertsRead } from '@/lib/viral';
import { markAlertsReadSchema } from '@/lib/viral/validations';

// POST /api/v1/viral/alerts/read - Mark alerts as read
export async function POST(request: NextRequest) {
  try {
    getAuthUser(request);

    const body = await request.json();
    const parsed = markAlertsReadSchema.parse(body);

    const count = await markAlertsRead(parsed.alertIds);
    return NextResponse.json({ data: { markedRead: count } });
  } catch (error) {
    return errorResponse(error);
  }
}
