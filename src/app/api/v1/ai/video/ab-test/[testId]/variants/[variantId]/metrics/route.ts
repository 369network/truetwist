export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { updateVariantMetrics } from '@/lib/ai/video-ab-test-service';

const metricsSchema = z.object({
  impressions: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  watchTimeSeconds: z.number().min(0).optional(),
  completionRate: z.number().min(0).max(100).optional(),
  conversions: z.number().int().min(0).optional(),
  engagements: z.number().int().min(0).optional(),
});

// PATCH /api/v1/ai/video/ab-test/:testId/variants/:variantId/metrics
export async function PATCH(
  request: NextRequest,
  { params }: { params: { testId: string; variantId: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const parsed = metricsSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    // Verify ownership through test
    const test = await prisma.videoAbTest.findFirst({
      where: { id: params.testId, userId: user.sub },
    });
    if (!test) throw Errors.notFound('Video A/B Test');

    // Verify variant belongs to test
    const variant = await prisma.videoAbTestVariant.findFirst({
      where: { id: params.variantId, testId: params.testId },
    });
    if (!variant) throw Errors.notFound('Variant');

    await updateVariantMetrics(params.variantId, parsed.data);

    const updated = await prisma.videoAbTestVariant.findUniqueOrThrow({
      where: { id: params.variantId },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
