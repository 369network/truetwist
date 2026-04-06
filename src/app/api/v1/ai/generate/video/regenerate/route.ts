import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { checkCredits } from '@/lib/ai/credit-service';
import { moderateContent } from '@/lib/ai/content-moderation';
import { queueVideoGeneration } from '@/lib/ai/video-queue-service';
import type { BrandContext, VideoAspectRatio } from '@/lib/ai/types';

const regenerateSchema = z.object({
  jobId: z.string().uuid(),
  modifiedPrompt: z.string().min(1).max(4000).optional(),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).optional(),
  durationSeconds: z.number().int().min(5).max(60).optional(),
});

// POST /api/v1/ai/generate/video/regenerate — Re-generate with modified prompt
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = regenerateSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const data = result.data;

    // Check credits
    const credits = await checkCredits(user.sub, 'video');
    if (!credits.allowed) {
      throw Errors.badRequest('Video generation credit limit reached');
    }

    // Get source job
    const sourceJob = await prisma.videoGenerationJob.findFirst({
      where: { id: data.jobId, userId: user.sub },
    });
    if (!sourceJob) throw Errors.notFound('Video generation job');

    const prompt = data.modifiedPrompt || sourceJob.prompt;

    // Moderate the new prompt if changed
    if (data.modifiedPrompt) {
      const moderation = await moderateContent(data.modifiedPrompt);
      if (moderation.flagged) {
        throw Errors.badRequest(`Content flagged: ${moderation.message}`);
      }
    }

    // Get business for brand context
    const business = await prisma.business.findFirst({
      where: { id: sourceJob.businessId, userId: user.sub },
    });
    if (!business) throw Errors.notFound('Business');

    const brand: BrandContext = {
      businessName: business.name,
      industry: business.industry ?? undefined,
      description: business.description ?? undefined,
      brandVoice: business.brandVoice ?? undefined,
      targetAudience: business.targetAudience as Record<string, unknown>,
      colors: business.colors as BrandContext['colors'],
      logoUrl: business.logoUrl ?? undefined,
    };

    const newJob = await queueVideoGeneration({
      userId: user.sub,
      businessId: sourceJob.businessId,
      prompt,
      platform: sourceJob.platform as any,
      template: sourceJob.template ?? undefined,
      aspectRatio: (data.aspectRatio || sourceJob.aspectRatio) as VideoAspectRatio,
      durationSeconds: data.durationSeconds || sourceJob.durationSeconds,
      scriptJson: sourceJob.scriptJson as Record<string, unknown> | undefined,
      brand,
      parentJobId: sourceJob.id,
      metadata: { operation: 'regenerate', sourceJobId: sourceJob.id },
    });

    return NextResponse.json(
      {
        data: {
          jobId: newJob.id,
          status: newJob.status,
          message: 'Regeneration queued.',
        },
      },
      { status: 202 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
