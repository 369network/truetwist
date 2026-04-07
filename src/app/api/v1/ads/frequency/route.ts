export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { AdFrequencyService } from '@/lib/ads/ad-frequency-service';
import { z } from 'zod';

const frequencyService = new AdFrequencyService();

const upsertSchema = z.object({
  businessId: z.string().uuid(),
  galleryType: z.string().min(1).max(50).optional(),
  adEveryN: z.number().int().min(1).max(100).optional(),
  maxAdsPerPage: z.number().int().min(0).max(20).optional(),
  firstAdAfter: z.number().int().min(0).max(100).optional(),
  adFreeForPremium: z.boolean().optional(),
  adFreePlans: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    if (!businessId) throw Errors.validation({ businessId: 'Required' });

    const configs = await frequencyService.listConfigs(user.sub, businessId);
    return NextResponse.json({ data: configs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    const config = await frequencyService.upsertConfig({
      userId: user.sub,
      ...parsed.data,
    });

    return NextResponse.json({ data: config });
  } catch (error) {
    return errorResponse(error);
  }
}
