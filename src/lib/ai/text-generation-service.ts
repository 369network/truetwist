import { openai } from './openai-client';
import { PLATFORM_CONSTRAINTS, type Platform } from '@/lib/social/types';
import { AI_TEXT_MODEL, estimateModelCost } from './model-config';
import { VERTICAL_PROMPT_MODULES } from './vertical-prompts';
import { evaluateVerticalFit } from './vertical-scoring-service';
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

    // Inject vertical prompt module if industry matches
    const verticalModule = VERTICAL_PROMPT_MODULES[brand.industry];
    if (verticalModule) {
      prompt += `\n\n## Industry-Specific Instructions\n${verticalModule.systemInstructions}`;
      prompt += `\n\n## Compliance Requirements\n${verticalModule.complianceGuardrails}`;
      prompt += `\n\nKey industry terminology to use naturally: ${verticalModule.terminology.join(', ')}`;
      prompt += `\n\n## Example Posts (for style reference)`;
      for (const example of verticalModule.fewShotExamples) {
        prompt += `\n\n### ${example.label}:\n${example.text}`;
      }
    }
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


export async function generateText(
  request: TextGenerationRequest,
  brand: BrandContext
): Promise<TextGenerationResult> {
  const startTime = Date.now();

  const systemPrompt = buildSystemPrompt(brand);
  const userPrompt = buildUserPrompt(request, brand);

  const response = await openai.chat.completions.create({
    model: AI_TEXT_MODEL,
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

  // Evaluate vertical fit if industry is set and matches a vertical module
  let verticalScore = undefined;
  if (brand.industry && VERTICAL_PROMPT_MODULES[brand.industry]) {
    const combinedText = variants.map((v) => v.text).join('\n\n');
    verticalScore = await evaluateVerticalFit(
      combinedText,
      brand.industry,
      request.template ?? 'engagement'
    );
  }

  return {
    variants,
    verticalScore,
    model: AI_TEXT_MODEL,
    tokensInput,
    tokensOutput,
    costCents: estimateModelCost(AI_TEXT_MODEL, tokensInput, tokensOutput),
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
    model: AI_TEXT_MODEL,
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
