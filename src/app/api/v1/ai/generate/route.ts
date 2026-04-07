export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse, Errors } from "@/lib/errors";
import { z } from "zod";
import { openai } from "@/lib/ai/openai-client";
import { scoreContent } from "@/lib/ai/content-quality-scoring";
import type { Platform } from "@/lib/social/types";

const generateTextSchema = z.object({
  prompt: z.string().min(1).max(2000),
  platforms: z.array(z.string()).min(1),
  variations: z.number().int().min(1).max(5).default(3),
  businessId: z.string().uuid().optional(),
  tone: z.string().max(100).optional(),
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

    if (type === "text") {
      const result = generateTextSchema.safeParse(body);
      if (!result.success) {
        throw Errors.validation(result.error.flatten().fieldErrors);
      }

      const { prompt, platforms, variations, tone } = result.data;
      const startTime = Date.now();

      const platformConstraints: Record<string, number> = {
        instagram: 2200,
        twitter: 280,
        linkedin: 3000,
        tiktok: 2200,
        facebook: 63206,
        youtube: 5000,
        pinterest: 500,
        threads: 500,
      };

      // Use OpenAI for real content generation with unified prompt
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are TrueTwist AI — an expert social media content creator. Generate authentic, engaging, platform-optimized content.

Rules:
- Write real, specific content. Never use placeholders.
- Each variation should take a genuinely different angle/approach.
- Respect platform character limits.
- Do NOT include hashtags in the post text.
${tone ? `- Tone: ${tone}` : ""}

Respond in JSON:
{
  "variations": [
    {
      "text": "the post text",
      "hashtags": ["Tag1", "Tag2"],
      "platforms": [
        { "platform": "instagram", "charCount": 120, "maxChars": 2200, "withinLimit": true }
      ]
    }
  ]
}`,
          },
          {
            role: "user",
            content: `Create ${variations} unique social media post variations about: "${prompt}"

Target platforms: ${platforms.join(", ")}
Platform limits: ${platforms.map((p) => `${p}: ${platformConstraints[p] || 2000} chars`).join(", ")}

Generate ${variations} variations, each with text, 5-8 hashtags, and platform metadata.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
        max_tokens: 2000,
      });

      const rawContent = completion.choices[0]?.message?.content || "{}";
      const tokensInput = completion.usage?.prompt_tokens ?? 0;
      const tokensOutput = completion.usage?.completion_tokens ?? 0;
      const durationMs = Date.now() - startTime;

      let generatedVariations: Array<{
        id: string;
        text: string;
        hashtags: string[];
        platforms: Array<{
          platform: string;
          charCount: number;
          maxChars: number;
          withinLimit: boolean;
        }>;
        qualityScore?: ReturnType<typeof scoreContent>;
      }>;

      try {
        const parsed = JSON.parse(rawContent) as {
          variations: Array<{
            text: string;
            hashtags: string[];
            platforms: Array<{
              platform: string;
              charCount: number;
              maxChars: number;
              withinLimit: boolean;
            }>;
          }>;
        };

        generatedVariations = parsed.variations.map((v, i) => ({
          id: `gen-${Date.now()}-${i}`,
          text: v.text,
          hashtags: (v.hashtags || []).map((h) =>
            h.startsWith("#") ? h.slice(1) : h,
          ),
          platforms: platforms.map((p) => ({
            platform: p,
            charCount: v.text.length,
            maxChars: platformConstraints[p] || 2000,
            withinLimit: v.text.length <= (platformConstraints[p] || 2000),
          })),
          qualityScore: scoreContent(v.text, platforms[0] as Platform),
        }));
      } catch {
        // Fallback if parsing fails
        generatedVariations = [
          {
            id: `gen-${Date.now()}-0`,
            text: rawContent,
            hashtags: [],
            platforms: platforms.map((p) => ({
              platform: p,
              charCount: rawContent.length,
              maxChars: platformConstraints[p] || 2000,
              withinLimit:
                rawContent.length <= (platformConstraints[p] || 2000),
            })),
          },
        ];
      }

      // Log the generation
      await prisma.aiGeneration.create({
        data: {
          userId: user.sub,
          generationType: "text",
          prompt,
          modelUsed: "gpt-4o-mini",
          outputText: JSON.stringify(generatedVariations.map((v) => v.text)),
          tokensInput,
          tokensOutput,
          costCents: Math.ceil(
            (tokensInput / 1_000_000) * 15 + (tokensOutput / 1_000_000) * 60,
          ),
          durationMs,
        },
      });

      return NextResponse.json({
        data: {
          type: "text",
          variations: generatedVariations,
          suggestedHashtags:
            generatedVariations[0]?.hashtags?.map((h) => `#${h}`) ?? [],
        },
      });
    }

    if (type === "image") {
      const result = generateImageSchema.safeParse(body);
      if (!result.success) {
        throw Errors.validation(result.error.flatten().fieldErrors);
      }

      const { prompt, style, count } = result.data;
      const startTime = Date.now();

      // Simulated image generation — image API integration handled by /api/v1/ai/generate/image
      const images = Array.from({ length: count }, (_, i) => ({
        id: `img-${Date.now()}-${i}`,
        url: `/api/v1/ai/placeholder?w=1024&h=1024&text=${encodeURIComponent(prompt.slice(0, 30))}&i=${i}`,
        thumbnailUrl: `/api/v1/ai/placeholder?w=256&h=256&text=${encodeURIComponent(prompt.slice(0, 30))}&i=${i}`,
        width: 1024,
        height: 1024,
        style: style || "default",
      }));

      const durationMs = Date.now() - startTime;

      await prisma.aiGeneration.create({
        data: {
          userId: user.sub,
          generationType: "image",
          prompt,
          modelUsed: "truetwist-image-v1",
          outputMediaUrl: JSON.stringify(images.map((img) => img.url)),
          tokensInput: prompt.length,
          tokensOutput: 0,
          costCents: count * 2,
          durationMs,
        },
      });

      return NextResponse.json({
        data: { type: "image", images },
      });
    }

    throw Errors.badRequest('Invalid generation type. Use "text" or "image".');
  } catch (error) {
    return errorResponse(error);
  }
}
