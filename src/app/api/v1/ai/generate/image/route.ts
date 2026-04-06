export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { PlatformSchema } from '@/lib/social/types';
import { generateImage } from '@/lib/ai/image-generation-service';
import { checkCredits, recordGeneration } from '@/lib/ai/credit-service';
import { moderateContent } from '@/lib/ai/content-moderation';
import type { BrandContext } from '@/lib/ai/types';

const imageGenerateSchema = z.object({
  businessId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
  platform: PlatformSchema,
  template: z
    .enum([
      'quote-graphic',
      'product-showcase',
      'infographic',
      'carousel-slide',
      'social-post',
    ])
    .optional(),
  style: z
    .enum(['minimalist', 'bold', 'elegant', 'playful', 'corporate'])
    .optional(),
  size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional(),
  count: z.number().int().min(1).max(4).optional(),
});

// POST /api/v1/ai/generate/image
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = imageGenerateSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const data = result.data;

    // Check credits
    const credits = await checkCredits(user.sub, 'image');
    if (!credits.allowed) {
      throw Errors.badRequest(
        `Image generation credit limit reached. Remaining: ${credits.remaining}`
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

    const brand: BrandContext = {
      businessName: business.name,
      industry: business.industry ?? undefined,
      description: business.description ?? undefined,
      brandVoice: business.brandVoice ?? undefined,
      targetAudience: business.targetAudience as Record<string, unknown>,
      colors: business.colors as BrandContext['colors'],
      logoUrl: business.logoUrl ?? undefined,
    };

    const generation = await generateImage(
      {
        userId: user.sub,
        businessId: data.businessId,
        prompt: data.prompt,
        platform: data.platform,
        template: data.template,
        style: data.style,
        size: data.size,
        count: data.count,
      },
      brand
    );

    const generationId = await recordGeneration({
      userId: user.sub,
      type: 'image',
      prompt: data.prompt,
      model: generation.model,
      outputMediaUrl: generation.images[0]?.url,
      costCents: generation.costCents,
      durationMs: generation.durationMs,
    });

    return NextResponse.json(
      {
        data: {
          id: generationId,
          images: generation.images,
          model: generation.model,
          usage: {
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
