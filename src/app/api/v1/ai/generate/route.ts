export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { z } from 'zod';

const generateTextSchema = z.object({
  prompt: z.string().min(1).max(2000),
  platforms: z.array(z.string()).min(1),
  variations: z.number().int().min(1).max(5).default(3),
  businessId: z.string().uuid().optional(),
});

const generateImageSchema = z.object({
  prompt: z.string().min(1).max(1000),
  style: z.string().optional(),
  count: z.number().int().min(1).max(4).default(4),
  businessId: z.string().uuid().optional(),
});

// POST /api/v1/ai/generate - Generate AI content
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const { type } = body;

    if (type === 'text') {
      const result = generateTextSchema.safeParse(body);
      if (!result.success) {
        throw Errors.validation(result.error.flatten().fieldErrors);
      }

      const { prompt, platforms, variations } = result.data;
      const startTime = Date.now();

      // Generate text variations (simulated AI for now - would integrate with OpenAI/Claude)
      const platformConstraints: Record<string, number> = {
        instagram: 2200, twitter: 280, linkedin: 3000,
        tiktok: 2200, facebook: 63206, youtube: 5000,
        pinterest: 500, threads: 500,
      };

      const generatedVariations = Array.from({ length: variations }, (_, i) => {
        const maxLen = Math.min(...platforms.map(p => platformConstraints[p] || 2000));
        return {
          id: `gen-${Date.now()}-${i}`,
          text: generateTextVariation(prompt, i, maxLen),
          platforms: platforms.map(p => ({
            platform: p,
            charCount: 0, // will be calculated below
            maxChars: platformConstraints[p] || 2000,
            withinLimit: true,
          })),
        };
      });

      // Calculate char counts
      for (const v of generatedVariations) {
        for (const p of v.platforms) {
          p.charCount = v.text.length;
          p.withinLimit = p.charCount <= p.maxChars;
        }
      }

      const durationMs = Date.now() - startTime;

      // Log the generation
      await prisma.aiGeneration.create({
        data: {
          userId: user.sub,
          generationType: 'text',
          prompt,
          modelUsed: 'truetwist-text-v1',
          outputText: JSON.stringify(generatedVariations.map(v => v.text)),
          tokensInput: prompt.length,
          tokensOutput: generatedVariations.reduce((sum, v) => sum + v.text.length, 0),
          costCents: 1,
          durationMs,
        },
      });

      return NextResponse.json({
        data: {
          type: 'text',
          variations: generatedVariations,
          suggestedHashtags: generateHashtags(prompt),
        },
      });
    }

    if (type === 'image') {
      const result = generateImageSchema.safeParse(body);
      if (!result.success) {
        throw Errors.validation(result.error.flatten().fieldErrors);
      }

      const { prompt, style, count } = result.data;
      const startTime = Date.now();

      // Simulated image generation - would integrate with DALL-E/Stable Diffusion
      const images = Array.from({ length: count }, (_, i) => ({
        id: `img-${Date.now()}-${i}`,
        url: `/api/v1/ai/placeholder?w=1024&h=1024&text=${encodeURIComponent(prompt.slice(0, 30))}&i=${i}`,
        thumbnailUrl: `/api/v1/ai/placeholder?w=256&h=256&text=${encodeURIComponent(prompt.slice(0, 30))}&i=${i}`,
        width: 1024,
        height: 1024,
        style: style || 'default',
      }));

      const durationMs = Date.now() - startTime;

      await prisma.aiGeneration.create({
        data: {
          userId: user.sub,
          generationType: 'image',
          prompt,
          modelUsed: 'truetwist-image-v1',
          outputMediaUrl: JSON.stringify(images.map(img => img.url)),
          tokensInput: prompt.length,
          tokensOutput: 0,
          costCents: count * 2,
          durationMs,
        },
      });

      return NextResponse.json({
        data: { type: 'image', images },
      });
    }

    throw Errors.badRequest('Invalid generation type. Use "text" or "image".');
  } catch (error) {
    return errorResponse(error);
  }
}

function generateTextVariation(prompt: string, index: number, maxLen: number): string {
  // In production, this would call OpenAI/Claude API
  // For now, generate contextual variations based on the prompt
  const tones = ['professional', 'casual', 'inspirational'];
  const tone = tones[index % tones.length];

  const variations: Record<string, (p: string) => string> = {
    professional: (p) =>
      `${p.charAt(0).toUpperCase() + p.slice(1)} — delivering results that matter. Our data-driven approach transforms how you connect with your audience. #Strategy #Growth`,
    casual: (p) =>
      `Hey! 👋 Let's talk about ${p.toLowerCase()}. It's not just a trend — it's the future of connecting with people who care about what you do. Ready to level up? ✨`,
    inspirational: (p) =>
      `Transform your approach to ${p.toLowerCase()}. Every great brand started with a single post, a single connection. Today is your day to start. 🚀 #Inspiration`,
  };

  const text = variations[tone]?.(prompt) || prompt;
  return text.slice(0, maxLen);
}

function generateHashtags(prompt: string): string[] {
  const words = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const base = ['#ContentCreation', '#SocialMedia', '#DigitalMarketing', '#GrowthHacking'];
  const fromPrompt = words.slice(0, 4).map(w => `#${w.charAt(0).toUpperCase() + w.slice(1)}`);
  return Array.from(new Set([...fromPrompt, ...base])).slice(0, 8);
}
