import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { getGenerationHistory } from '@/lib/ai/credit-service';
import type { GenerationType } from '@/lib/ai/types';

// GET /api/v1/ai/history - Get user's AI generation history
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type') as GenerationType | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(
      parseInt(searchParams.get('pageSize') || '20', 10),
      100
    );

    const { records, total } = await getGenerationHistory(user.sub, {
      type: type || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return NextResponse.json({
      data: records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
