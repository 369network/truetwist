export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { PlatformSchema } from '@/lib/social/types';
import { checkCredits, recordGeneration } from '@/lib/ai/credit-service';
import { moderateContent } from '@/lib/ai/content-moderation';
import { CreatifyService } from '@/lib/ai/creatify-service';
import type { BrandContext, VideoAspectRatio } from '@/lib/ai/types';

const videoAdSchema = z.object({
  businessId: z.string().uuid(),
  url: z.string().url(),
  platform: PlatformSchema,
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).optional(),
  style: z.string().max(50).optional(),
  voiceover: z.boolean().optional(),
  durationSeconds: z.number().int().min(5).max(120).optional(),
  templateId: z.string().optional(),
  headline: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  callToAction: z.string().max(50).optional(),
});

function getPlatformAspectRatio(platform: string): VideoAspectRatio {
  const ratioMap: Record<string, VideoAspectRatio> = {
    instagram: '9:16',
    facebook: '16:9',
    twitter: '16:9',
    linkedin: '16:9',
    tiktok: '9:16',
    youtube: '16:9',
    pinterest: '9:16',
    threads: '1:1',
  };
  return ratioMap[platform] || '16:9';
}

// POST /api/v1/ai/generate/video-ad — Create a video ad from URL via Creatify
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = videoAdSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const data = result.data;

    // Check credits
    const credits = await checkCredits(user.sub, 'video');
    if (!credits.allowed) {
      throw Errors.badRequest(
        'Video generation limit reached. Upgrade plan for more.'
      );
    }

    // Content moderation on headline/description if provided
    if (data.headline) {
      const mod = await moderateContent(data.headline);
      if (mod.flagged) {
        throw Errors.badRequest('Headline content flagged by moderation.');
      }
    }

    // Get brand context
    const business = await prisma.business.findFirst({
      where: { id: data.businessId, userId: user.sub },
    });
    if (!business) {
      throw Errors.notFound('Business');
    }

    const brand: BrandContext = {
      businessName: business.name,
      industry: business.industry ?? undefined,
      description: business.description ?? undefined,
    };

    const aspectRatio = data.aspectRatio || getPlatformAspectRatio(data.platform);
    const startTime = Date.now();

    let jobResult: { jobId: string };

    if (data.templateId) {
      jobResult = await CreatifyService.createVideoFromTemplate(
        data.templateId,
        {
          productUrl: data.url,
          headline: data.headline,
          description: data.description,
          callToAction: data.callToAction,
          aspectRatio,
          brand,
        }
      );
    } else {
      jobResult = await CreatifyService.createVideoFromUrl({
        url: data.url,
        platform: data.platform,
        aspectRatio,
        style: data.style,
        voiceover: data.voiceover,
        brand,
        durationSeconds: data.durationSeconds,
      });
    }

    // Record generation credit usage
    await recordGeneration({
      userId: user.sub,
      type: 'video',
      prompt: `URL-to-video: ${data.url}`,
      model: 'creatify-url-to-video',
      costCents: 10,
      durationMs: Date.now() - startTime,
    });

    // Store job reference for polling
    await prisma.adAuditLog.create({
      data: {
        userId: user.sub,
        action: 'video_ad_generation_started',
        entityType: 'creatify_job',
        entityId: jobResult.jobId,
        details: {
          url: data.url,
          platform: data.platform,
          aspectRatio,
          templateId: data.templateId,
          businessId: data.businessId,
        },
      },
    });

    return NextResponse.json({
      data: {
        jobId: jobResult.jobId,
        status: 'pending',
        platform: data.platform,
        aspectRatio,
      },
    }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
