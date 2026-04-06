export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { getUserCredits, getMonthlySpend } from '@/lib/ai/credit-service';

// GET /api/v1/ai/credits - Get user's AI generation credits
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);

    const [credits, monthlySpendCents] = await Promise.all([
      getUserCredits(user.sub),
      getMonthlySpend(user.sub),
    ]);

    return NextResponse.json({
      data: {
        credits,
        monthlySpendCents,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
