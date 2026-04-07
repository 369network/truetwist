export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { AdPositionTestService } from '@/lib/ads/ad-position-test-service';
import { z } from 'zod';

const positionTestService = new AdPositionTestService();

const createSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  targetMetric: z.enum(['ctr', 'viewability', 'revenue_per_session']).optional(),
  minSampleSize: z.number().int().min(10).max(100000).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  variants: z.array(z.object({
    label: z.string().min(1).max(10),
    position: z.enum(['above_gallery', 'between_images', 'below_gallery', 'sidebar']),
    frequency: z.number().int().min(1).max(50).optional(),
  })).min(2).max(5),
});

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const status = searchParams.get('status') as 'draft' | 'running' | 'completed' | 'cancelled' | null;

    if (!businessId) throw Errors.validation({ businessId: 'Required' });

    const tests = await positionTestService.listTests(user.sub, businessId, status ?? undefined);
    return NextResponse.json({ data: tests });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    const id = await positionTestService.createTest({
      userId: user.sub,
      ...parsed.data,
      startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : undefined,
      endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : undefined,
    });

    const test = await positionTestService.getTest(id);
    return NextResponse.json({ data: test }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
