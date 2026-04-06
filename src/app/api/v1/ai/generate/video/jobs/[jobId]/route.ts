export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { getVideoJob, cancelVideoJob } from '@/lib/ai/video-queue-service';

// GET /api/v1/ai/generate/video/jobs/:jobId — Get job status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = getAuthUser(request);
    const { jobId } = await params;

    const job = await getVideoJob(jobId, user.sub);
    if (!job) throw Errors.notFound('Video generation job');

    return NextResponse.json({ data: job });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/ai/generate/video/jobs/:jobId — Cancel a queued job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = getAuthUser(request);
    const { jobId } = await params;

    const cancelled = await cancelVideoJob(jobId, user.sub);
    if (!cancelled) {
      throw Errors.badRequest('Job cannot be cancelled (already processing or completed)');
    }

    return NextResponse.json({ data: { cancelled: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
