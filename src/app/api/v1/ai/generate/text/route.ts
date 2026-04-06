import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { PlatformSchema } from '@/lib/social/types';
import { generateText } from '@/lib/ai/text-generation-service';
import { checkCredits, recordGeneration } from '@/lib/ai/credit-service';
import { moderateContent } from '@/lib/ai/content-moderation';
import type { BrandContext } from '@/lib/ai/types';

const textGenerateSchema = z.object({
  businessId: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
  platforms: z.array(PlatformSchema).min(1).max(8),
  template: z
    .enum([
      'educational',
      'promotional',
      'storytelling',
      'engagement',
      'announcement',
      'behind-the-scenes',
    ])
    .optional(),
  tone: z.string().max(100).optional(),
  includeHashtags: z.boolean().optional(),
  variantCount: z.number().int().min(1).max(5).optional(),
  threadMode: z.boolean().optional(),
});

// POST /api/v1/ai/generate/text
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = textGenerateSchema.safeParse(body);

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
    const moderation = await moderateContent(data.prompt);
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

    // Generate text
    const generation = await generateText(
      {
        userId: user.sub,
        businessId: data.businessId,
        prompt: data.prompt,
        platforms: data.platforms,
        template: data.template,
        tone: data.tone,
        includeHashtags: data.includeHashtags,
        variantCount: data.variantCount,
        threadMode: data.threadMode,
      },
      brand
    );

    // Record generation
    const generationId = await recordGeneration({
      userId: user.sub,
      type: 'text',
      prompt: data.prompt,
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
