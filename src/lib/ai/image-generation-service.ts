import { openai } from "./openai-client";
import {
  getGrokClient,
  isConfigured as isGrokConfigured,
  estimateGrokImageCost,
  GrokApiError,
} from "./grok-client";
import { PLATFORM_CONSTRAINTS, type Platform } from "@/lib/social/types";
import { VERTICAL_IMAGE_STYLES } from "./vertical-prompts";
import type {
  BrandContext,
  ImageGenerationRequest,
  ImageGenerationResult,
  GeneratedImage,
  ImageStylePreset,
  ImageTemplate,
} from "./types";

const STYLE_MODIFIERS: Record<ImageStylePreset, string> = {
  minimalist:
    "Clean, minimal design with plenty of white space. Simple shapes, muted colors, modern sans-serif typography.",
  bold: "Bold, vibrant colors with high contrast. Strong typography, eye-catching geometric shapes, dynamic composition.",
  elegant:
    "Sophisticated and refined aesthetic. Muted earth tones or jewel tones, serif typography, subtle textures.",
  playful:
    "Fun, energetic design with bright colors. Rounded shapes, casual typography, playful illustrations.",
  corporate:
    "Professional, trustworthy aesthetic. Clean layout, corporate blue tones, structured grid, business-appropriate imagery.",
};

const TEMPLATE_PROMPTS: Record<ImageTemplate, string> = {
  "quote-graphic":
    "A visually appealing quote graphic with beautiful typography. The quote text should be the focal point with a complementary background.",
  "product-showcase":
    "A product showcase image with professional photography style. Clean background, good lighting, product as hero element.",
  infographic:
    "An informative infographic-style image with data visualization, icons, and clear hierarchy of information.",
  "carousel-slide":
    "A clean, branded carousel slide suitable for a multi-image post. Consistent style with space for text overlay.",
  "social-post":
    "A general social media post image that is visually engaging and scroll-stopping. Optimized for the feed.",
};

function getPlatformSizeHint(platform: Platform): string {
  const sizeMap: Record<string, string> = {
    instagram: "1080x1080 (square feed) or 1080x1350 (portrait)",
    facebook: "1200x630 (feed) or 1080x1080 (square)",
    twitter: "1200x675 (landscape)",
    linkedin: "1200x627 (landscape)",
    tiktok: "1080x1920 (vertical)",
    youtube: "1280x720 (thumbnail)",
    pinterest: "1000x1500 (vertical pin)",
    threads: "1080x1080 (square)",
  };
  return sizeMap[platform] || "1080x1080";
}

function buildImagePrompt(
  request: ImageGenerationRequest,
  brand: BrandContext,
): string {
  let prompt = request.prompt;

  if (request.template) {
    prompt = `${TEMPLATE_PROMPTS[request.template]}. Content: ${prompt}`;
  }

  if (request.style) {
    prompt += `. Style: ${STYLE_MODIFIERS[request.style]}`;
  }

  // Inject vertical image style when industry matches a known vertical
  if (
    request.verticalTemplate &&
    VERTICAL_IMAGE_STYLES[request.verticalTemplate]
  ) {
    prompt += `. Industry visual style: ${VERTICAL_IMAGE_STYLES[request.verticalTemplate]}`;
  } else if (brand.industry && VERTICAL_IMAGE_STYLES[brand.industry]) {
    prompt += `. Industry visual style: ${VERTICAL_IMAGE_STYLES[brand.industry]}`;
  }

  // Brand-aware prompting
  if (brand.colors) {
    prompt += `. Use brand colors: primary ${brand.colors.primary}, secondary ${brand.colors.secondary}, accent ${brand.colors.accent}`;
  }

  prompt += `. Optimized for ${request.platform} (${getPlatformSizeHint(request.platform)})`;

  // Safety: no text in images to avoid AI text rendering issues
  prompt += `. Do NOT include any text or written words in the image unless specifically asked. Focus on visual elements only.`;

  return prompt;
}

function selectDallESize(
  request: ImageGenerationRequest,
): "1024x1024" | "1792x1024" | "1024x1792" {
  if (request.size) return request.size;

  // Auto-select based on platform
  const verticalPlatforms: Platform[] = ["tiktok", "pinterest"];
  const landscapePlatforms: Platform[] = [
    "twitter",
    "linkedin",
    "facebook",
    "youtube",
  ];

  if (verticalPlatforms.includes(request.platform)) return "1024x1792";
  if (landscapePlatforms.includes(request.platform)) return "1792x1024";
  return "1024x1024";
}

// DALL-E 3 pricing: $0.040 per image (1024x1024), $0.080 (1024x1792 / 1792x1024)
function estimateImageCost(
  size: "1024x1024" | "1792x1024" | "1024x1792",
  count: number,
): number {
  const costPerImage = size === "1024x1024" ? 4 : 8; // cents
  return costPerImage * count;
}

async function generateImageWithGrok(
  prompt: string,
  count: number,
  size: string,
): Promise<ImageGenerationResult> {
  const startTime = Date.now();
  const grok = getGrokClient();
  const images: GeneratedImage[] = [];

  for (let i = 0; i < count; i++) {
    const response = await grok.images.generate({
      model: "grok-2-image",
      prompt,
      n: 1,
    });

    const data = response.data?.[0];
    if (data?.url) {
      images.push({
        url: data.url,
        revisedPrompt: (data as any).revised_prompt ?? prompt,
        size,
      });
    }
  }

  return {
    images,
    model: "grok-2-image",
    costCents: estimateGrokImageCost(images.length),
    durationMs: Date.now() - startTime,
  };
}

async function generateImageWithDallE(
  prompt: string,
  count: number,
  size: "1024x1024" | "1792x1024" | "1024x1792",
): Promise<ImageGenerationResult> {
  const startTime = Date.now();
  const images: GeneratedImage[] = [];

  // DALL-E 3 only supports n=1, so we loop for multiple images
  for (let i = 0; i < count; i++) {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      quality: "standard",
      response_format: "url",
    });

    const data = response.data?.[0];
    if (data?.url) {
      images.push({
        url: data.url,
        revisedPrompt: data.revised_prompt ?? prompt,
        size,
      });
    }
  }

  return {
    images,
    model: "dall-e-3",
    costCents: estimateImageCost(size, images.length),
    durationMs: Date.now() - startTime,
  };
}

export async function generateImage(
  request: ImageGenerationRequest,
  brand: BrandContext,
): Promise<ImageGenerationResult> {
  const count = Math.min(request.count ?? 1, 4);
  const size = selectDallESize(request);
  const prompt = buildImagePrompt(request, brand);

  // Use Grok Aurora when XAI_API_KEY is configured, fall back to DALL-E 3
  if (isGrokConfigured()) {
    return generateImageWithGrok(prompt, count, size);
  }

  return generateImageWithDallE(prompt, count, size);
}

export async function generateImageVariations(
  imageUrl: string,
  count: number = 3,
): Promise<GeneratedImage[]> {
  // Note: DALL-E 3 does not support variations natively.
  // This uses DALL-E 2 for variations from an existing image.
  // In production, download the image to a buffer first.
  const images: GeneratedImage[] = [];

  // Placeholder for variation logic - would need image download + buffer
  // For now, return empty array as this requires file upload
  return images;
}
