export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { generateContentSuggestions } from '@/lib/recommendations';
import { PlatformSchema } from '@/lib/social/types';
import { z } from 'zod';

const querySchema = z.object({
  businessId: z.string().uuid(),
  platforms: z.string().optional(), // comma-separated
  count: z.coerce.number().min(1).max(20).optional(),
  includeCompetitorInspired: z.coerce.boolean().optional(),
  includeSeasonal: z.coerce.boolean().optional(),
});

// GET /api/v1/recommendations/suggestions?businessId=...&platforms=instagram,twitter&count=5
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const params = querySchema.parse({
      businessId: searchParams.get('businessId'),
      platforms: searchParams.get('platforms') || undefined,
      count: searchParams.get('count') || undefined,
      includeCompetitorInspired: searchParams.get('includeCompetitorInspired') || undefined,
      includeSeasonal: searchParams.get('includeSeasonal') || undefined,
    });

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { id: params.businessId, userId: user.sub },
    });
    if (!business) throw Errors.notFound('Business');

    const platforms = params.platforms
      ?.split(',')
      .map((p) => PlatformSchema.parse(p.trim()));

    const suggestions = await generateContentSuggestions({
      userId: user.sub,
      businessId: params.businessId,
      platforms,
      count: params.count,
      includeCompetitorInspired: params.includeCompetitorInspired,
      includeSeasonal: params.includeSeasonal,
    });

    return NextResponse.json({ data: suggestions });
  } catch (error) {
    return errorResponse(error);
  }
}
