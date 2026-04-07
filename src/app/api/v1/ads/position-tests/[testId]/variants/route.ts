export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { AdPositionTestService } from '@/lib/ads/ad-position-test-service';
import { z } from 'zod';

const positionTestService = new AdPositionTestService();

const recordMetricsSchema = z.object({
  variantId: z.string().uuid(),
  impressions: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  viewableImpressions: z.number().int().min(0).optional(),
  revenueCents: z.number().int().min(0).optional(),
  sessions: z.number().int().min(0).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    getAuthUser(request);
    await params; // validate route param exists
    const body = await request.json();

    const parsed = recordMetricsSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    await positionTestService.recordMetrics(parsed.data.variantId, {
      impressions: parsed.data.impressions,
      clicks: parsed.data.clicks,
      viewableImpressions: parsed.data.viewableImpressions,
      revenueCents: parsed.data.revenueCents,
      sessions: parsed.data.sessions,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
