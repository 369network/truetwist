import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { computeViralScore } from '@/lib/viral';
import { viralScoreSchema } from '@/lib/viral/validations';

// POST /api/v1/viral/score - Compute viral score for given metrics
export async function POST(request: NextRequest) {
  try {
    getAuthUser(request);

    const body = await request.json();
    const input = viralScoreSchema.parse(body);

    const result = computeViralScore(input);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
