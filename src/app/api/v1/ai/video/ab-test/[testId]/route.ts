export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import {
  getVideoAbTest,
  generateTestVariants,
  syncVariantStatuses,
  completeTest,
  cancelTest,
  checkSignificance,
} from '@/lib/ai/video-ab-test-service';
import type { BrandContext } from '@/lib/ai/types';

// GET /api/v1/ai/video/ab-test/:testId — Get test detail with significance
export async function GET(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
  try {
    const user = getAuthUser(request);
    const test = await getVideoAbTest(params.testId, user.sub);
    if (!test) throw Errors.notFound('Video A/B Test');

    // Sync variant statuses from video jobs if still generating
    if (test.status === 'generating') {
      await syncVariantStatuses(params.testId);
      const refreshed = await getVideoAbTest(params.testId, user.sub);
      if (refreshed) {
        const significance = refreshed.status === 'running'
          ? await checkSignificance(params.testId)
          : null;
        return NextResponse.json({ data: { ...refreshed, significance } });
      }
    }

    const significance = test.status === 'running'
      ? await checkSignificance(params.testId)
      : null;

    return NextResponse.json({ data: { ...test, significance } });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/ai/video/ab-test/:testId — Actions: generate, complete, cancel
export async function PATCH(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const { action, winnerId } = body;

    const test = await prisma.videoAbTest.findFirst({
      where: { id: params.testId, userId: user.sub },
    });
    if (!test) throw Errors.notFound('Video A/B Test');

    switch (action) {
      case 'generate': {
        if (test.status !== 'draft') throw Errors.badRequest('Can only generate from draft status');
        const business = await prisma.business.findFirst({
          where: { id: test.businessId, userId: user.sub },
        });
        if (!business) throw Errors.notFound('Business');
        const brand: BrandContext = {
          businessName: business.name,
          industry: business.industry ?? undefined,
          description: business.description ?? undefined,
          brandVoice: business.brandVoice ?? undefined,
          targetAudience: business.targetAudience as Record<string, unknown>,
          colors: business.colors as BrandContext['colors'],
          logoUrl: business.logoUrl ?? undefined,
        };
        await generateTestVariants(params.testId, user.sub, brand);
        break;
      }
      case 'complete': {
        if (!['running', 'generating'].includes(test.status)) {
          throw Errors.badRequest('Can only complete running or generating tests');
        }
        await completeTest(params.testId, user.sub, winnerId);
        break;
      }
      case 'cancel': {
        if (['completed', 'cancelled'].includes(test.status)) {
          throw Errors.badRequest('Test already finished');
        }
        await cancelTest(params.testId, user.sub);
        break;
      }
      default:
        throw Errors.badRequest('Action must be generate, complete, or cancel');
    }

    const updated = await getVideoAbTest(params.testId, user.sub);
    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/ai/video/ab-test/:testId — Delete a test
export async function DELETE(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
  try {
    const user = getAuthUser(request);

    const test = await prisma.videoAbTest.findFirst({
      where: { id: params.testId, userId: user.sub },
    });
    if (!test) throw Errors.notFound('Video A/B Test');

    await prisma.videoAbTest.delete({ where: { id: params.testId } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
