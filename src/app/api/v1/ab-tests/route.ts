export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { AbTestService } from '@/lib/analytics/ab-test-service';
import { z } from 'zod';

const abTestService = new AbTestService();

const createAbTestSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  targetMetric: z.enum(['engagement_rate', 'reach', 'clicks']).optional(),
  minSampleSize: z.number().int().min(10).max(100000).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  variants: z.array(z.object({
    label: z.string().min(1).max(10),
    postId: z.string().uuid().optional(),
    platform: z.string().optional(),
    socialAccountId: z.string().uuid().optional(),
  })).min(2).max(5),
});

// GET /api/v1/ab-tests - List A/B tests
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const where: Record<string, unknown> = { userId: user.sub };
    if (status) where.status = status;

    const tests = await prisma.abTest.findMany({
      where,
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ data: tests });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/ab-tests - Create a new A/B test
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    const parsed = createAbTestSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    const { businessId, name, description, targetMetric, minSampleSize, startAt, endAt, variants } = parsed.data;

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: user.sub },
    });
    if (!business) throw Errors.notFound('Business');

    const testId = await abTestService.createTest({
      userId: user.sub,
      businessId,
      name,
      description,
      targetMetric: targetMetric as 'engagement_rate' | 'reach' | 'clicks',
      minSampleSize,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      variants,
    });

    const test = await prisma.abTest.findUniqueOrThrow({
      where: { id: testId },
      include: { variants: true },
    });

    return NextResponse.json({ data: test }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
