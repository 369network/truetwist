import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { queueVideoGeneration } from '@/lib/ai/video-queue-service';
import type { BrandContext, VideoAspectRatio } from '@/lib/ai/types';

const trimSchema = z.object({
  jobId: z.string().uuid(),
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(1),
});

// POST /api/v1/ai/generate/video/trim — Trim/clip a completed video
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = trimSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { jobId, startSeconds, endSeconds } = result.data;

    if (endSeconds <= startSeconds) {
      throw Errors.badRequest('endSeconds must be greater than startSeconds');
    }

    const sourceJob = await prisma.videoGenerationJob.findFirst({
      where: { id: jobId, userId: user.sub, status: 'ready' },
    });
    if (!sourceJob) {
      throw Errors.badRequest('Source video must be in ready status');
    }

    if (endSeconds > sourceJob.durationSeconds) {
      throw Errors.badRequest(`endSeconds exceeds video duration (${sourceJob.durationSeconds}s)`);
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

    // Queue a new job with trim metadata
    const trimJob = await queueVideoGeneration({
      userId: user.sub,
      businessId: sourceJob.businessId,
      prompt: sourceJob.prompt,
      platform: sourceJob.platform as any,
      template: sourceJob.template ?? undefined,
      aspectRatio: sourceJob.aspectRatio as VideoAspectRatio,
      durationSeconds: Math.round(endSeconds - startSeconds),
      brand,
      parentJobId: sourceJob.id,
      metadata: {
        operation: 'trim',
        sourceJobId: sourceJob.id,
        sourceVideoUrl: sourceJob.outputVideoUrl,
        startSeconds,
        endSeconds,
      },
    });

    return NextResponse.json(
      {
        data: {
          jobId: trimJob.id,
          status: trimJob.status,
          trimmedDuration: Math.round(endSeconds - startSeconds),
          message: 'Trim job queued.',
        },
      },
      { status: 202 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
