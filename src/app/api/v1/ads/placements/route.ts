export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { AdFrequencyService } from '@/lib/ads/ad-frequency-service';
import { AdPositionTestService } from '@/lib/ads/ad-position-test-service';
import { z } from 'zod';

const frequencyService = new AdFrequencyService();
const positionTestService = new AdPositionTestService();

const placementQuerySchema = z.object({
  businessId: z.string().uuid(),
  galleryType: z.string().optional(),
  totalImages: z.number().int().min(0),
  viewerPlan: z.string().optional(),
  visitorId: z.string().optional(),
});

/**
 * POST /api/v1/ads/placements
 * Get ad placement decisions for a gallery view.
 * Combines frequency config, ad-free checks, and active position A/B tests.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    const parsed = placementQuerySchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    const { businessId, galleryType, totalImages, viewerPlan, visitorId } = parsed.data;

    // Get base ad placements from frequency config
    const placement = await frequencyService.getAdPlacements(
      user.sub,
      businessId,
      galleryType ?? 'default',
      totalImages,
      viewerPlan ?? 'free'
    );

    if (!placement.showAds) {
      return NextResponse.json({
        data: { showAds: false, slots: [], positionTest: null },
      });
    }

    // Check for active position A/B test
    const activeTests = await positionTestService.listTests(user.sub, businessId, 'running');
    let positionTest = null;

    if (activeTests.length > 0 && visitorId) {
      const test = activeTests[0];
      const variants = test.variants.map((v) => ({
        id: v.id,
        label: v.label,
        position: v.position,
        frequency: v.frequency,
      }));

      const assignment = positionTestService.assignVariant(test.id, visitorId, variants);
      positionTest = {
        testId: test.id,
        variantId: assignment.variantId,
        position: assignment.position,
        frequency: assignment.frequency,
      };
    }

    return NextResponse.json({
      data: {
        showAds: true,
        slots: placement.slots,
        positionTest,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
