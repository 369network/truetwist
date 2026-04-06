import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { scheduleTrendCollection, getAvailableSources, getTrendQueueStats } from '@/lib/viral';
import { triggerCollectionSchema } from '@/lib/viral/validations';

// POST /api/v1/viral/collect - Trigger trend collection
export async function POST(request: NextRequest) {
  try {
    getAuthUser(request);

    const body = await request.json();
    const parsed = triggerCollectionSchema.parse(body);

    const queued = await scheduleTrendCollection(parsed.region);

    return NextResponse.json({
      data: {
        jobsQueued: queued,
        availableSources: getAvailableSources(),
        region: parsed.region,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /api/v1/viral/collect - Get collection queue stats
export async function GET(request: NextRequest) {
  try {
    getAuthUser(request);

    const stats = await getTrendQueueStats();
    const sources = getAvailableSources();

    return NextResponse.json({
      data: { queueStats: stats, availableSources: sources },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
