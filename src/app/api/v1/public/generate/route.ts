export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiKeyUser, requireScope } from '@/middleware/api-key';
import { errorResponse, Errors } from '@/lib/errors';

// POST /api/v1/public/generate - Trigger AI content generation
export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'write');

    const body = await request.json();
    const { type = 'text', prompt, businessId, platform } = body;

    if (!prompt || typeof prompt !== 'string') {
      throw Errors.validation({ prompt: 'prompt is required' });
    }

    if (!businessId) {
      throw Errors.validation({ businessId: 'businessId is required' });
    }

    if (!['text', 'image', 'video'].includes(type)) {
      throw Errors.validation({ type: 'type must be text, image, or video' });
    }

    // Verify business belongs to user
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: apiUser.sub },
    });
    if (!business) throw Errors.notFound('Business');

    // For text generation, use OpenAI directly
    if (type === 'text') {
      // Record the generation request
      const generation = await prisma.aiGeneration.create({
        data: {
          userId: apiUser.sub,
          generationType: 'text',
          prompt,
          modelUsed: 'gpt-4o',
          outputText: null, // Will be populated by the AI service
          tokensInput: 0,
          tokensOutput: 0,
          costCents: 0,
          durationMs: 0,
        },
      });

      return NextResponse.json({
        data: {
          id: generation.id,
          type: 'text',
          status: 'queued',
          prompt,
          message: 'Content generation has been queued. Poll GET /api/v1/public/generate?generationId={id} for results.',
        },
      }, { status: 202 });
    }

    if (type === 'image') {
      const generation = await prisma.aiGeneration.create({
        data: {
          userId: apiUser.sub,
          generationType: 'image',
          prompt,
          modelUsed: 'dall-e-3',
        },
      });

      return NextResponse.json({
        data: {
          id: generation.id,
          type: 'image',
          status: 'queued',
          prompt,
        },
      }, { status: 202 });
    }

    // Video generation
    const job = await prisma.videoGenerationJob.create({
      data: {
        userId: apiUser.sub,
        businessId,
        prompt,
        platform: platform || 'instagram',
        aspectRatio: '9:16',
        durationSeconds: 15,
        status: 'queued',
      },
    });

    return NextResponse.json({
      data: {
        id: job.id,
        type: 'video',
        status: 'queued',
        prompt,
      },
    }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /api/v1/public/generate - Check generation status
export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'read');

    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('generationId');
    const videoJobId = searchParams.get('videoJobId');

    if (generationId) {
      const gen = await prisma.aiGeneration.findFirst({
        where: { id: generationId, userId: apiUser.sub },
      });
      if (!gen) throw Errors.notFound('Generation');
      return NextResponse.json({ data: gen });
    }

    if (videoJobId) {
      const job = await prisma.videoGenerationJob.findFirst({
        where: { id: videoJobId, userId: apiUser.sub },
        include: { variants: true },
      });
      if (!job) throw Errors.notFound('Video job');
      return NextResponse.json({ data: job });
    }

    // List recent generations
    const generations = await prisma.aiGeneration.findMany({
      where: { userId: apiUser.sub },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ data: generations });
  } catch (error) {
    return errorResponse(error);
  }
}
