export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { AdRevenueService } from '@/lib/ads/ad-revenue-service';
import { z } from 'zod';

const revenueService = new AdRevenueService();

const recordEventSchema = z.object({
  businessId: z.string().uuid(),
  network: z.string().min(1),
  eventType: z.enum(['impression', 'click', 'viewable_impression', 'conversion']),
  revenueCents: z.number().int().min(0).optional(),
  cpm: z.number().min(0).optional(),
  position: z.string().optional(),
  waterfallTier: z.number().int().optional(),
  positionTestId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const batchSchema = z.object({
  events: z.array(recordEventSchema).min(1).max(1000),
});

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const view = searchParams.get('view') ?? 'summary';

    if (!businessId) throw Errors.validation({ businessId: 'Required' });
    if (!startDate || !endDate) throw Errors.validation({ dates: 'startDate and endDate required' });

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (view === 'daily') {
      const daily = await revenueService.getDailyRevenue(user.sub, businessId, start, end);
      return NextResponse.json({ data: daily });
    }

    if (view === 'networks') {
      const networks = await revenueService.getNetworkComparison(user.sub, businessId, start, end);
      return NextResponse.json({ data: networks });
    }

    const summary = await revenueService.getRevenueSummary(user.sub, businessId, start, end);
    return NextResponse.json({ data: summary });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    // Single event
    if (!body.events) {
      const parsed = recordEventSchema.safeParse(body);
      if (!parsed.success) throw Errors.validation(parsed.error.flatten());

      const id = await revenueService.recordEvent({
        userId: user.sub,
        ...parsed.data,
      });
      return NextResponse.json({ data: { id } }, { status: 201 });
    }

    // Batch events
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    const count = await revenueService.recordBatch(
      parsed.data.events.map((e) => ({ userId: user.sub, ...e }))
    );
    return NextResponse.json({ data: { count } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
