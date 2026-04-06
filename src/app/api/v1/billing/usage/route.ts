export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { getUsageSummary } from '@/lib/billing';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const summary = await getUsageSummary(user.sub);
    return NextResponse.json({ data: summary });
  } catch (error) {
    return errorResponse(error);
  }
}
