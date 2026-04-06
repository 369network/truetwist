export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { PlatformSchema } from '@/lib/social/types';
import { checkCredits } from '@/lib/ai/credit-service';
import { queueVideoGeneration } from '@/lib/ai/video-queue-service';
import { getBatchVariantTargets, getPrimaryFormat } from '@/lib/ai/video-post-processing';
import type { BrandContext, VideoAspectRatio } from '@/lib/ai/types';

const batchSchema = z.object({
  jobId: z.string().uuid().optional(),
  businessId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
  platforms: z.array(PlatformSchema).min(1).max(8),
  durationSeconds: z.number().int().min(5).max(60).optional(),
  template: z.string().optional(),
});

// POST /api/v1/ai/generate/video/batch — Generate platform-specific variants from one source
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = batchSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const data = result.data;

    // Check credits for all platforms
    const credits = await checkCredits(user.sub, 'video');
    if (!credits.allowed || credits.remaining < data.platforms.length) {
      throw Errors.badRequest(
        `Not enough video credits. Need ${data.platforms.length}, have ${credits.remaining}`
      );
    }

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { id: data.businessId, userId: user.sub },
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

    const batchGroup = uuidv4();
    const jobs = [];

    // If a source job was provided, use it as the parent for format conversions
    let parentJobId: string | undefined;
    if (data.jobId) {
      const sourceJob = await prisma.videoGenerationJob.findFirst({
        where: { id: data.jobId, userId: user.sub, status: 'ready' },
      });
      if (sourceJob) {
        parentJobId = sourceJob.id;
      }
    }

    for (const platform of data.platforms) {
      const spec = getPrimaryFormat(platform);
      const duration = data.durationSeconds
        ? Math.min(data.durationSeconds, Math.max(...spec.maxDurationSeconds))
        : spec.maxDurationSeconds[0];

      const job = await queueVideoGeneration({
        userId: user.sub,
        businessId: data.businessId,
        prompt: data.prompt,
        platform,
        template: data.template,
        aspectRatio: spec.aspectRatio,
        durationSeconds: duration,
        brand,
        batchGroup,
        parentJobId,
        metadata: { batchPlatform: platform },
      });
      jobs.push(job);
    }

    return NextResponse.json(
      {
        data: {
          batchGroup,
          jobs,
          totalJobs: jobs.length,
          message: `${jobs.length} video generation jobs queued.`,
        },
      },
      { status: 202 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
