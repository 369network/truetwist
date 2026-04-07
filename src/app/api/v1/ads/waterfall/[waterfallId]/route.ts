export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { AdWaterfallService } from '@/lib/ads/ad-waterfall-service';
import { z } from 'zod';

const waterfallService = new AdWaterfallService();

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ waterfallId: string }> }
) {
  try {
    getAuthUser(request);
    const { waterfallId } = await params;

    const waterfall = await waterfallService.getWaterfall(waterfallId);
    if (!waterfall) throw Errors.notFound('Waterfall config');

    return NextResponse.json({ data: waterfall });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ waterfallId: string }> }
) {
  try {
    getAuthUser(request);
    const { waterfallId } = await params;
    const body = await request.json();

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    const waterfall = await waterfallService.updateWaterfall(waterfallId, parsed.data);
    return NextResponse.json({ data: waterfall });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ waterfallId: string }> }
) {
  try {
    getAuthUser(request);
    const { waterfallId } = await params;

    await waterfallService.deleteWaterfall(waterfallId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
