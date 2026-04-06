import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { AbTestService } from '@/lib/analytics/ab-test-service';
import { z } from 'zod';

const abTestService = new AbTestService();

const updateVariantSchema = z.object({
  variantId: z.string().uuid(),
  impressions: z.number().int().min(0),
  reach: z.number().int().min(0),
  engagements: z.number().int().min(0),
  likes: z.number().int().min(0),
  comments: z.number().int().min(0),
  shares: z.number().int().min(0),
  clicks: z.number().int().min(0),
});

// GET /api/v1/ab-tests/:testId/variants - Get variants for a test
export async function GET(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
  try {
    const user = getAuthUser(request);

    const test = await prisma.abTest.findFirst({
      where: { id: params.testId, userId: user.sub },
    });
    if (!test) throw Errors.notFound('A/B Test');

    const variants = await prisma.abTestVariant.findMany({
      where: { testId: params.testId },
      orderBy: { label: 'asc' },
    });

    return NextResponse.json({ data: variants });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/ab-tests/:testId/variants - Update variant metrics
export async function PATCH(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    const parsed = updateVariantSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    const test = await prisma.abTest.findFirst({
      where: { id: params.testId, userId: user.sub },
    });
    if (!test) throw Errors.notFound('A/B Test');
    if (test.status !== 'running') throw Errors.badRequest('Can only update running test variants');

    const variant = await prisma.abTestVariant.findFirst({
      where: { id: parsed.data.variantId, testId: params.testId },
    });
    if (!variant) throw Errors.notFound('Variant');

    await abTestService.updateVariantMetrics(parsed.data.variantId, {
      impressions: parsed.data.impressions,
      reach: parsed.data.reach,
      engagements: parsed.data.engagements,
      likes: parsed.data.likes,
      comments: parsed.data.comments,
      shares: parsed.data.shares,
      clicks: parsed.data.clicks,
    });

    const updated = await prisma.abTestVariant.findUniqueOrThrow({
      where: { id: parsed.data.variantId },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
