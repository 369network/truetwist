import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { getDimensions, getPlatformFormats } from '@/lib/ai/video-post-processing';
import type { VideoAspectRatio, VideoPreviewInfo } from '@/lib/ai/types';

const previewSchema = z.object({
  jobId: z.string().uuid(),
});

// POST /api/v1/ai/generate/video/preview — Get video preview info
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = previewSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const job = await prisma.videoGenerationJob.findFirst({
      where: { id: result.data.jobId, userId: user.sub },
    });
    if (!job) throw Errors.notFound('Video generation job');

    // Build platform preview info showing how the video will look on each platform
    const platformFormats = getPlatformFormats(job.platform as any);
    const platformPreviews = platformFormats.map((spec) => ({
      platform: spec.platform,
      aspectRatio: spec.aspectRatio as VideoAspectRatio,
      width: spec.width,
      height: spec.height,
    }));

    const preview: VideoPreviewInfo = {
      jobId: job.id,
      thumbnailUrl: job.thumbnailUrl,
      durationSeconds: job.durationSeconds,
      aspectRatio: job.aspectRatio as VideoAspectRatio,
      platform: job.platform,
      status: job.status,
      platformPreviews,
    };

    return NextResponse.json({ data: preview });
  } catch (error) {
    return errorResponse(error);
  }
}
