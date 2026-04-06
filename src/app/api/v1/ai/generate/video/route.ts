export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { PlatformSchema } from '@/lib/social/types';
import { checkCredits, recordGeneration } from '@/lib/ai/credit-service';
import { moderateContent } from '@/lib/ai/content-moderation';
import { queueVideoGeneration, listVideoJobs } from '@/lib/ai/video-queue-service';
import { renderTemplate } from '@/lib/ai/video-templates';
import { getPrimaryFormat, clampDuration } from '@/lib/ai/video-post-processing';
import type { BrandContext, VideoAspectRatio } from '@/lib/ai/types';
import type { VideoTemplateId } from '@/lib/ai/video-templates';

const videoGenerateSchema = z.object({
  businessId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
  platform: PlatformSchema,
  template: z
    .enum([
      'text-animation', 'product-showcase', 'talking-head', 'slideshow',
      'before-after', 'testimonial', 'stat-reveal', 'tip-carousel',
    ])
    .optional(),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).optional(),
  durationSeconds: z.number().int().min(5).max(60).optional(),
  script: z.string().max(5000).optional(),
  templateContent: z.object({
    headline: z.string().optional(),
    bodyText: z.string().optional(),
    stats: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    testimonialQuote: z.string().optional(),
    testimonialAuthor: z.string().optional(),
    beforeDescription: z.string().optional(),
    afterDescription: z.string().optional(),
    tips: z.array(z.string()).optional(),
    productName: z.string().optional(),
    productDescription: z.string().optional(),
    callToAction: z.string().optional(),
  }).optional(),
});

// POST /api/v1/ai/generate/video — Queue a video generation job
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = videoGenerateSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const data = result.data;

    // Check credits
    const credits = await checkCredits(user.sub, 'video');
    if (!credits.allowed) {
      throw Errors.badRequest(
        `Video generation credit limit reached. Remaining: ${credits.remaining}`
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

    // Resolve aspect ratio and duration from platform defaults
    const platformSpec = getPrimaryFormat(data.platform);
    const aspectRatio: VideoAspectRatio = data.aspectRatio || platformSpec.aspectRatio;
    const durationSeconds = clampDuration(
      data.platform,
      data.durationSeconds || platformSpec.maxDurationSeconds[0]
    );

    // If a template is specified, render it for script/prompt enrichment
    let scriptJson: Record<string, unknown> | undefined;
    if (data.template) {
      const rendered = renderTemplate({
        templateId: data.template as VideoTemplateId,
        platform: data.platform,
        aspectRatio,
        durationSeconds,
        brand,
        content: data.templateContent || { headline: data.prompt },
      });
      scriptJson = {
        prompt: rendered.prompt,
        scenes: rendered.scenes,
        voiceoverScript: rendered.voiceoverScript,
        musicMood: rendered.musicMood,
      };
    }

    // Queue async video generation
    const job = await queueVideoGeneration({
      userId: user.sub,
      businessId: data.businessId,
      prompt: data.prompt,
      platform: data.platform,
      template: data.template,
      aspectRatio,
      durationSeconds,
      scriptJson,
      brand,
    });

    // Record generation credit usage
    await recordGeneration({
      userId: user.sub,
      type: 'video',
      prompt: data.prompt,
      model: 'runway-gen3',
      costCents: job.costCents,
      durationMs: 0,
    });

    return NextResponse.json(
      {
        data: {
          jobId: job.id,
          status: job.status,
          estimatedCostCents: job.costCents,
          message: 'Video generation queued. Poll GET /api/v1/ai/generate/video/jobs/:jobId for status.',
        },
      },
      { status: 202 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /api/v1/ai/generate/video — List user's video generation jobs
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const jobs = await listVideoJobs(user.sub, { status, limit, offset });

    return NextResponse.json({ data: jobs });
  } catch (error) {
    return errorResponse(error);
  }
}
