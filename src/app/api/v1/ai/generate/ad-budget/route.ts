export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { optimizeAdBudget } from '@/lib/ai/ad-optimization-service';
import { checkCredits, recordGeneration } from '@/lib/ai/credit-service';
import type { BrandContext, AdPerformanceMetric, AdPlatform } from '@/lib/ai/types';

const adPlatformSchema = z.enum(['meta', 'google', 'tiktok']);

const performanceMetricSchema = z.object({
  platform: adPlatformSchema,
  campaignId: z.string().optional(),
  campaignName: z.string().optional(),
  spend: z.number().min(0),
  impressions: z.number().int().min(0),
  clicks: z.number().int().min(0),
  conversions: z.number().int().min(0),
  revenue: z.number().min(0),
  ctr: z.number().min(0),
  cpc: z.number().min(0),
  roas: z.number().min(0),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

const adBudgetSchema = z.object({
  businessId: z.string().uuid(),
  totalBudget: z.number().positive(),
  platforms: z.array(adPlatformSchema).min(1).max(3),
  historicalMetrics: z.array(performanceMetricSchema).default([]),
  objective: z.enum(['conversions', 'awareness', 'engagement', 'traffic', 'app_installs']),
  constraints: z
    .object({
      minPerPlatformPct: z.number().min(0).max(100).optional(),
      maxPerPlatformPct: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

// POST /api/v1/ai/generate/ad-budget
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = adBudgetSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const data = result.data;

    // Check credits
    const credits = await checkCredits(user.sub, 'text');
    if (!credits.allowed) {
      throw Errors.badRequest(
        `Text generation credit limit reached. Remaining: ${credits.remaining}`
      );
    }

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { id: data.businessId, userId: user.sub },
    });
    if (!business) throw Errors.notFound('Business');

    // Build brand context
    const brand: BrandContext = {
      businessName: business.name,
      industry: business.industry ?? undefined,
      description: business.description ?? undefined,
      brandVoice: business.brandVoice ?? undefined,
      targetAudience: business.targetAudience as Record<string, unknown>,
      colors: business.colors as BrandContext['colors'],
      logoUrl: business.logoUrl ?? undefined,
    };

    // Parse metrics dates
    const historicalMetrics: AdPerformanceMetric[] = data.historicalMetrics.map(
      (m) => ({
        ...m,
        platform: m.platform as AdPlatform,
        periodStart: new Date(m.periodStart),
        periodEnd: new Date(m.periodEnd),
      })
    );

    // Generate allocation
    const allocation = await optimizeAdBudget(
      {
        userId: user.sub,
        businessId: data.businessId,
        totalBudget: data.totalBudget,
        platforms: data.platforms,
        historicalMetrics,
        objective: data.objective,
        constraints: data.constraints,
      },
      brand
    );

    // Record generation
    const generationId = await recordGeneration({
      userId: user.sub,
      type: 'text',
      prompt: `Ad budget allocation: $${data.totalBudget} across ${data.platforms.join(', ')} for ${data.objective}`,
      model: allocation.model,
      outputText: JSON.stringify(allocation.allocations),
      tokensInput: allocation.tokensInput,
      tokensOutput: allocation.tokensOutput,
      costCents: allocation.costCents,
      durationMs: allocation.durationMs,
    });

    return NextResponse.json(
      {
        data: {
          id: generationId,
          allocations: allocation.allocations,
          totalProjectedRoas: allocation.totalProjectedRoas,
          insights: allocation.insights,
          model: allocation.model,
          usage: {
            tokensInput: allocation.tokensInput,
            tokensOutput: allocation.tokensOutput,
            costCents: allocation.costCents,
            durationMs: allocation.durationMs,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
