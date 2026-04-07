export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { PlatformSchema } from '@/lib/social/types';
import {
  createVideoAbTest,
  generateTestVariants,
  listVideoAbTests,
} from '@/lib/ai/video-ab-test-service';
import type { BrandContext } from '@/lib/ai/types';
import type { VideoAbTestStatus } from '@/lib/ai/video-ab-test-service';

const variationParamSchema = z.object({
  field: z.enum(['headline', 'cta', 'music', 'template', 'aspectRatio']),
  values: z.array(z.string().min(1)).min(1).max(5),
});

const createVideoAbTestSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  targetMetric: z.enum(['watch_time', 'clicks', 'conversions', 'engagement_rate']).optional(),
  minSampleSize: z.number().int().min(10).max(100000).optional(),
  baseConfig: z.object({
    prompt: z.string().min(1).max(4000),
    platform: PlatformSchema,
    template: z.string().optional(),
    aspectRatio: z.enum(['9:16', '16:9', '1:1']).optional(),
    durationSeconds: z.number().int().min(5).max(60).optional(),
    templateContent: z.record(z.string(), z.unknown()).optional(),
  }),
  variationParams: z.array(variationParamSchema).min(1).max(4),
  autoGenerate: z.boolean().optional(), // start video generation immediately
});

// POST /api/v1/ai/video/ab-test — Create a video A/B test
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const parsed = createVideoAbTestSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    const data = parsed.data;

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { id: data.businessId, userId: user.sub },
    });
    if (!business) throw Errors.notFound('Business');

    const testId = await createVideoAbTest({
      userId: user.sub,
      businessId: data.businessId,
      name: data.name,
      description: data.description,
      targetMetric: data.targetMetric,
      baseConfig: data.baseConfig,
      variationParams: data.variationParams,
      minSampleSize: data.minSampleSize,
    });

    // Optionally start video generation right away
    if (data.autoGenerate) {
      const brand: BrandContext = {
        businessName: business.name,
        industry: business.industry ?? undefined,
        description: business.description ?? undefined,
        brandVoice: business.brandVoice ?? undefined,
        targetAudience: business.targetAudience as Record<string, unknown>,
        colors: business.colors as BrandContext['colors'],
        logoUrl: business.logoUrl ?? undefined,
      };
      await generateTestVariants(testId, user.sub, brand);
    }

    const test = await prisma.videoAbTest.findUniqueOrThrow({
      where: { id: testId },
      include: { variants: { orderBy: { label: 'asc' } } },
    });

    return NextResponse.json({ data: test }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /api/v1/ai/video/ab-test — List video A/B tests
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as VideoAbTestStatus | null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const tests = await listVideoAbTests(user.sub, {
      status: status || undefined,
      limit,
    });

    return NextResponse.json({ data: tests });
  } catch (error) {
    return errorResponse(error);
  }
}
