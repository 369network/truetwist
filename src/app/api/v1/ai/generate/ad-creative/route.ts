export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { generateAdCreative } from '@/lib/ai/ad-creative-service';
import { checkCredits, recordGeneration } from '@/lib/ai/credit-service';
import { moderateContent } from '@/lib/ai/content-moderation';
import type { BrandContext } from '@/lib/ai/types';

const adCreativeSchema = z.object({
  businessId: z.string().uuid(),
  platform: z.enum(['meta', 'google', 'tiktok']),
  objective: z.enum(['conversions', 'awareness', 'engagement', 'traffic', 'app_installs']),
  productOrService: z.string().min(1).max(500),
  targetAudience: z.string().max(500).optional(),
  campaignTheme: z.string().max(200).optional(),
  cta: z.string().max(50).optional(),
  variantCount: z.number().int().min(1).max(5).optional(),
});

// POST /api/v1/ai/generate/ad-creative
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = adCreativeSchema.safeParse(body);

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

    // Content moderation
    const moderation = await moderateContent(data.productOrService);
    if (moderation.flagged) {
      throw Errors.badRequest(
        `Content flagged by moderation: ${moderation.message}`
      );
    }

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

    // Generate ad creative
    const generation = await generateAdCreative(
      {
        userId: user.sub,
        businessId: data.businessId,
        platform: data.platform,
        objective: data.objective,
        productOrService: data.productOrService,
        targetAudience: data.targetAudience,
        campaignTheme: data.campaignTheme,
        cta: data.cta,
        variantCount: data.variantCount,
      },
      brand
    );

    // Record generation
    const generationId = await recordGeneration({
      userId: user.sub,
      type: 'text',
      prompt: `Ad creative for ${data.platform}: ${data.productOrService}`,
      model: generation.model,
      outputText: JSON.stringify(generation.variants),
      tokensInput: generation.tokensInput,
      tokensOutput: generation.tokensOutput,
      costCents: generation.costCents,
      durationMs: generation.durationMs,
    });

    return NextResponse.json(
      {
        data: {
          id: generationId,
          variants: generation.variants,
          model: generation.model,
          usage: {
            tokensInput: generation.tokensInput,
            tokensOutput: generation.tokensOutput,
            costCents: generation.costCents,
            durationMs: generation.durationMs,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
