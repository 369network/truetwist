import { openai } from './openai-client';
import { PLATFORM_CONSTRAINTS, type Platform } from '@/lib/social/types';
import type {
  BrandContext,
  TextGenerationRequest,
  TextGenerationResult,
  TextVariant,
  ContentTemplate,
} from './types';

const TEMPLATE_INSTRUCTIONS: Record<ContentTemplate, string> = {
  educational:
    'Create educational, informative content that teaches the audience something valuable. Use clear language, include actionable tips or insights.',
  promotional:
    'Create promotional content that highlights a product, service, or offer. Include a clear call-to-action. Be compelling but not pushy.',
  storytelling:
    'Create narrative-driven content that tells a story. Use an engaging hook, build tension or curiosity, and deliver a satisfying conclusion or takeaway.',
  engagement:
    'Create content designed to drive engagement (comments, shares, saves). Use questions, polls, controversial takes, or relatable scenarios.',
  announcement:
    'Create announcement-style content for news, launches, or updates. Be exciting and clear about what is new and why it matters.',
  'behind-the-scenes':
    'Create authentic behind-the-scenes content that humanizes the brand. Show process, team, or day-to-day moments.',
};

function buildSystemPrompt(brand: BrandContext): string {
  let prompt = `You are a professional social media content creator. You generate high-quality, engaging social media posts.`;

  if (brand.brandVoice) {
    prompt += `\n\nBrand Voice: ${brand.brandVoice}`;
  }
  if (brand.industry) {
    prompt += `\nIndustry: ${brand.industry}`;
  }
  if (brand.description) {
    prompt += `\nBusiness Description: ${brand.description}`;
  }
  if (brand.targetAudience && Object.keys(brand.targetAudience).length > 0) {
    prompt += `\nTarget Audience: ${JSON.stringify(brand.targetAudience)}`;
  }

  prompt += `\n\nRules:
- Write in the brand's voice consistently
- Make content feel authentic, not generic
- Include relevant emojis where appropriate
- Never include placeholder text like [brand name] — use "${brand.businessName}" directly`;

  return prompt;
}

function buildUserPrompt(
  request: TextGenerationRequest,
  brand: BrandContext
): string {
  const variantCount = request.variantCount ?? 3;

  let prompt = `Create ${variantCount} unique social media post variation(s) for "${brand.businessName}" based on this prompt:\n\n"${request.prompt}"`;

  if (request.template) {
    prompt += `\n\nContent Style: ${TEMPLATE_INSTRUCTIONS[request.template]}`;
  }

  if (request.tone) {
    prompt += `\n\nTone: ${request.tone}`;
  }

  prompt += `\n\nTarget Platforms: ${request.platforms.join(', ')}`;
  prompt += `\n\nFor each platform, respect these character limits:`;

  for (const platform of request.platforms) {
    const constraints = PLATFORM_CONSTRAINTS[platform];
    prompt += `\n- ${platform}: max ${constraints.maxTextLength} characters, max ${constraints.maxHashtags} hashtags`;
  }

  if (request.includeHashtags !== false) {
    prompt += `\n\nInclude relevant, trending hashtags for each post. Mix popular and niche hashtags.`;
  }

  if (request.threadMode) {
    prompt += `\n\nGenerate content suitable for a thread/carousel format with 3-5 connected parts.`;
  }

  prompt += `\n\nRespond in JSON format:
{
  "variants": [
    {
      "text": "the post text (including emojis, line breaks as \\n)",
      "hashtags": ["hashtag1", "hashtag2"],
      "platform": "platform_name"
    }
  ]
}

Generate one variant per platform per variation. Total variants: ${variantCount * request.platforms.length}.`;

  return prompt;
}

// Cost estimates in cents (per 1M tokens) — gpt-4o-mini pricing
const GPT4O_INPUT_COST_PER_M = 15; // $0.15 per 1M input tokens
const GPT4O_OUTPUT_COST_PER_M = 60; // $0.60 per 1M output tokens

function estimateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * GPT4O_INPUT_COST_PER_M;
  const outputCost = (outputTokens / 1_000_000) * GPT4O_OUTPUT_COST_PER_M;
  return Math.ceil(inputCost + outputCost);
}

export async function generateText(
  request: TextGenerationRequest,
  brand: BrandContext
): Promise<TextGenerationResult> {
  const startTime = Date.now();

  const systemPrompt = buildSystemPrompt(brand);
  const userPrompt = buildUserPrompt(request, brand);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8,
    max_tokens: 4096,
  });

  const durationMs = Date.now() - startTime;
  const tokensInput = response.usage?.prompt_tokens ?? 0;
  const tokensOutput = response.usage?.completion_tokens ?? 0;

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content returned from text generation');
  }

  const parsed = JSON.parse(content) as {
    variants: Array<{
      text: string;
      hashtags: string[];
      platform: string;
    }>;
  };

  const variants: TextVariant[] = parsed.variants.map((v) => ({
    text: v.text,
    hashtags: v.hashtags.map((h) => (h.startsWith('#') ? h.slice(1) : h)),
    platform: v.platform as Platform,
    characterCount: v.text.length,
  }));

  return {
    variants,
    model: 'gpt-4o-mini',
    tokensInput,
    tokensOutput,
    costCents: estimateCost(tokensInput, tokensOutput),
    durationMs,
  };
}

export async function generateHashtags(
  topic: string,
  platform: Platform,
  count: number = 15
): Promise<string[]> {
  const constraints = PLATFORM_CONSTRAINTS[platform];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a social media hashtag expert. Generate relevant, trending hashtags. Mix popular high-volume hashtags with niche ones for optimal reach. Return JSON: {"hashtags": ["tag1", "tag2"]}`,
      },
      {
        role: 'user',
        content: `Generate ${Math.min(count, constraints.maxHashtags)} hashtags for "${topic}" on ${platform}. Include a mix of popular and niche hashtags.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 512,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as { hashtags: string[] };
  return parsed.hashtags.map((h) => (h.startsWith('#') ? h.slice(1) : h));
}
