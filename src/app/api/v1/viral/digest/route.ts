export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { generateTrendDigest } from '@/lib/viral';

// GET /api/v1/viral/digest?period=daily
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);

    const period = (request.nextUrl.searchParams.get('period') || 'daily') as 'daily' | 'weekly';
    if (period !== 'daily' && period !== 'weekly') {
      return NextResponse.json(
        { error: { error: 'period must be "daily" or "weekly"', code: 'BAD_REQUEST' } },
        { status: 400 }
      );
    }

    const digest = await generateTrendDigest(auth.sub, period);
    return NextResponse.json({ data: digest });
  } catch (error) {
    return errorResponse(error);
  }
}
