export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { AdWaterfallService } from '@/lib/ads/ad-waterfall-service';
import { z } from 'zod';

const waterfallService = new AdWaterfallService();

const createWaterfallSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(200),
  tiers: z.array(z.object({
    network: z.string().min(1),
    priority: z.number().int().min(1),
    floorCpm: z.number().min(0).optional(),
    timeoutMs: z.number().int().min(500).max(30000).optional(),
    enabled: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })).min(1).max(10),
});

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const businessId = new URL(request.url).searchParams.get('businessId');
    if (!businessId) throw Errors.validation({ businessId: 'Required' });

    const waterfalls = await waterfallService.listWaterfalls(user.sub, businessId);
    return NextResponse.json({ data: waterfalls });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    const parsed = createWaterfallSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    const id = await waterfallService.createWaterfall({
      userId: user.sub,
      ...parsed.data,
    });

    const waterfall = await waterfallService.getWaterfall(id);
    return NextResponse.json({ data: waterfall }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
