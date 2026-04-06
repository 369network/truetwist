export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseWebhook } from '@/lib/video-providers';
import { errorResponse, Errors } from '@/lib/errors';
import type { ProviderJobStatus } from '@/lib/video-providers/types';

const WEBHOOK_SECRETS: Record<string, string | undefined> = {
  synthesia: process.env.SYNTHESIA_WEBHOOK_SECRET,
  heygen: process.env.HEYGEN_WEBHOOK_SECRET,
};

const VALID_PROVIDERS = new Set(['synthesia', 'heygen']);

function mapToJobStatus(
  providerStatus: ProviderJobStatus
): string {
  switch (providerStatus) {
    case 'completed':
      return 'ready';
    case 'failed':
      return 'failed';
    case 'processing':
      return 'generating';
    case 'pending':
      return 'queued';
    default:
      return 'generating';
  }
}

/**
 * POST /api/v1/ai/video/webhooks/:provider
 *
 * Receives job completion callbacks from Synthesia and HeyGen.
 * Updates the VideoGenerationJob record with the result.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    if (!VALID_PROVIDERS.has(provider)) {
      throw Errors.badRequest(`Unsupported provider: ${provider}`);
    }

    // Verify webhook secret if configured
    const secret = WEBHOOK_SECRETS[provider];
    if (secret) {
      const authHeader =
        request.headers.get('x-webhook-secret') ||
        request.headers.get('authorization');
      if (authHeader !== secret && authHeader !== `Bearer ${secret}`) {
        throw Errors.unauthorized('Invalid webhook secret');
      }
    }

    const body = (await request.json()) as Record<string, unknown>;
    const webhook = parseWebhook(provider, body);

    // Find the job by provider-specific task ID
    const job = await prisma.videoGenerationJob.findFirst({
      where: {
        provider,
        providerJobId: webhook.providerJobId,
      },
    });

    if (!job) {
      // Job not found — might be from an older system or different env.
      // Return 200 to prevent webhook retries.
      return NextResponse.json({
        received: true,
        matched: false,
        providerJobId: webhook.providerJobId,
      });
    }

    const newStatus = mapToJobStatus(webhook.status);

    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    if (webhook.videoUrl) {
      updateData.sourceVideoUrl = webhook.videoUrl;
      updateData.outputVideoUrl = webhook.videoUrl;
    }
    if (webhook.thumbnailUrl) {
      updateData.thumbnailUrl = webhook.thumbnailUrl;
    }
    if (webhook.errorMessage) {
      updateData.errorMessage = webhook.errorMessage;
    }
    if (newStatus === 'ready' || newStatus === 'failed') {
      updateData.completedAt = new Date();
    }

    await prisma.videoGenerationJob.update({
      where: { id: job.id },
      data: updateData,
    });

    return NextResponse.json({
      received: true,
      matched: true,
      jobId: job.id,
      status: newStatus,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
