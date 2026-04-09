export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { CreatifyService } from '@/lib/ai/creatify-service';

type RouteParams = { params: Promise<{ jobId: string }> };

// GET /api/v1/ai/generate/video-ad/[jobId] — Poll video ad generation status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    getAuthUser(request);
    const { jobId } = await params;

    if (!jobId || jobId.length < 1) {
      throw Errors.badRequest('Invalid job ID');
    }

    const job = await CreatifyService.getJobStatus(jobId);

    return NextResponse.json({
      data: {
        jobId: job.id,
        status: job.status,
        videoUrl: job.videoUrl ?? null,
        thumbnailUrl: job.thumbnailUrl ?? null,
        durationSeconds: job.durationSeconds ?? null,
        error: job.error ?? null,
        createdAt: job.createdAt,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
