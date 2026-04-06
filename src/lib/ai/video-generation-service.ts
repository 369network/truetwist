import { openai } from './openai-client';
import type {
  BrandContext,
  VideoGenerationRequest,
  VideoGenerationResult,
  GeneratedVideo,
  VideoTemplate,
  VideoAspectRatio,
} from './types';
import type { Platform } from '@/lib/social/types';

const TEMPLATE_SCRIPTS: Record<string, string> = {
  'text-animation':
    'Create a short text animation video with smooth transitions between text slides. Professional motion graphics style.',
  'product-showcase':
    'Create a product showcase video with cinematic transitions, close-up details, and dynamic camera movement.',
  'talking-head':
    'Create a professional talking-head style video suitable for tips, advice, or announcements.',
  slideshow:
    'Create a polished slideshow video with smooth transitions between scenes, suitable for storytelling or highlights.',
  'before-after':
    'Create a before/after comparison video with split-screen transition showing transformation.',
  testimonial:
    'Create a customer testimonial video with elegant text overlay and professional styling.',
  'stat-reveal':
    'Create an animated statistics reveal video with dynamic counting animations.',
  'tip-carousel':
    'Create an educational tip carousel video with numbered slides and smooth transitions.',
};

function getPlatformAspectRatio(platform: Platform): VideoAspectRatio {
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

function buildVideoPrompt(
  request: VideoGenerationRequest,
  brand: BrandContext
): string {
  let prompt = request.prompt;

  if (request.template) {
    prompt = `${TEMPLATE_SCRIPTS[request.template]} Content: ${prompt}`;
  }

  prompt += `. For ${brand.businessName}`;

  if (brand.industry) {
    prompt += ` in the ${brand.industry} industry`;
  }

  if (brand.colors) {
    prompt += `. Brand colors: ${brand.colors.primary}, ${brand.colors.secondary}`;
  }

  return prompt;
}

function buildScriptFromPrompt(
  request: VideoGenerationRequest,
  brand: BrandContext
): string {
  return `
Video Script for ${brand.businessName}
---
Topic: ${request.prompt}
Template: ${request.template || 'general'}
Duration: ${request.durationSeconds || 10} seconds
Aspect Ratio: ${request.aspectRatio || getPlatformAspectRatio(request.platform)}
Platform: ${request.platform}

${request.script || ''}
  `.trim();
}

// Video generation cost estimate (per generation)
// Runway Gen-3: ~$0.50 per 5 seconds of video
function estimateVideoCost(durationSeconds: number): number {
  return Math.ceil((durationSeconds / 5) * 50); // 50 cents per 5 sec
}

export async function generateVideo(
  request: VideoGenerationRequest,
  brand: BrandContext
): Promise<VideoGenerationResult> {
  const startTime = Date.now();
  const aspectRatio =
    request.aspectRatio || getPlatformAspectRatio(request.platform);
  const duration = Math.min(Math.max(request.durationSeconds || 10, 5), 15);

  // Foundation: Use GPT-4o to generate a detailed video script/storyboard
  // then generate a thumbnail using DALL-E 3
  const scriptPrompt = buildVideoPrompt(request, brand);

  const scriptResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a professional video script writer for short-form social media content. Create detailed shot-by-shot scripts that can be used with AI video generation tools. Include visual descriptions, text overlays, and timing for each scene.`,
      },
      {
        role: 'user',
        content: `Write a ${duration}-second video script for ${request.platform}.\n\n${scriptPrompt}\n\nFormat as JSON:\n{\n  "title": "video title",\n  "scenes": [\n    {\n      "sceneNumber": 1,\n      "durationSeconds": 3,\n      "visualDescription": "what appears on screen",\n      "textOverlay": "text shown (if any)",\n      "transition": "cut/fade/slide"\n    }\n  ],\n  "voiceoverScript": "full voiceover text (if applicable)",\n  "musicMood": "suggested background music mood"\n}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 2048,
  });

  const scriptContent = scriptResponse.choices[0]?.message?.content;
  if (!scriptContent) {
    throw new Error('Failed to generate video script');
  }

  const script = JSON.parse(scriptContent) as {
    title: string;
    scenes: Array<{
      sceneNumber: number;
      durationSeconds: number;
      visualDescription: string;
      textOverlay?: string;
      transition: string;
    }>;
    voiceoverScript?: string;
    musicMood?: string;
  };

  // Generate thumbnail using DALL-E 3
  const thumbnailPrompt = `Thumbnail for video: "${script.title}". ${script.scenes[0]?.visualDescription || request.prompt}. Professional, eye-catching, optimized for ${request.platform}.`;

  const thumbnailResponse = await openai.images.generate({
    model: 'dall-e-3',
    prompt: thumbnailPrompt,
    n: 1,
    size: aspectRatio === '9:16' ? '1024x1792' : aspectRatio === '1:1' ? '1024x1024' : '1792x1024',
    quality: 'standard',
  });

  const thumbnailUrl = thumbnailResponse.data[0]?.url;

  // Foundation implementation: return script + thumbnail
  // Full video generation would integrate with Runway Gen-3 or similar
  const video: GeneratedVideo = {
    url: '', // Placeholder - actual video URL from video generation API
    thumbnailUrl: thumbnailUrl || undefined,
    durationSeconds: duration,
    aspectRatio,
  };

  return {
    video,
    model: 'gpt-4o+dall-e-3',
    costCents: estimateVideoCost(duration) + 4, // video gen + thumbnail
    durationMs: Date.now() - startTime,
  };
}

export async function generateVideoScript(
  request: VideoGenerationRequest,
  brand: BrandContext
): Promise<{
  script: string;
  scenes: Array<{
    sceneNumber: number;
    durationSeconds: number;
    visualDescription: string;
    textOverlay?: string;
    transition: string;
  }>;
  voiceoverScript?: string;
}> {
  const scriptPrompt = buildVideoPrompt(request, brand);
  const duration = request.durationSeconds || 10;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a professional short-form video script writer. Create engaging, platform-optimized video scripts.',
      },
      {
        role: 'user',
        content: `Write a ${duration}-second video script for ${request.platform}.\n\n${scriptPrompt}\n\nFormat as JSON:\n{\n  "script": "full narrative script",\n  "scenes": [{"sceneNumber": 1, "durationSeconds": 3, "visualDescription": "description", "textOverlay": "text", "transition": "cut"}],\n  "voiceoverScript": "voiceover text"\n}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 2048,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Failed to generate video script');

  return JSON.parse(content);
}
