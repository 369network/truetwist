import { openai } from './openai-client';
import { AI_TEXT_MODEL, estimateModelCost } from './model-config';
import type {
  BrandContext,
  AdCreativeRequest,
  AdCreativeResult,
  AdCreativeVariant,
  AdPlatform,
} from './types';

const AD_PLATFORM_SPECS: Record<
  AdPlatform,
  { format: string; constraints: string; jsonShape: string }
> = {
  meta: {
    format: 'Meta (Facebook/Instagram) Ad',
    constraints:
      'Primary text: max 125 characters. Headline: max 40 characters. Description: max 30 characters. CTA: one of [Shop Now, Learn More, Sign Up, Download, Contact Us, Get Offer].',
    jsonShape: `{ "primaryText": "...", "headline": "...", "description": "...", "cta": "..." }`,
  },
  google: {
    format: 'Google Responsive Search Ad (RSA)',
    constraints:
      'Generate up to 15 headlines (max 30 chars each) and 4 descriptions (max 90 chars each). Headlines should be varied and include keywords. Descriptions should expand on value props.',
    jsonShape: `{ "headlines": ["h1","h2",...], "descriptions": ["d1","d2",...] }`,
  },
  tiktok: {
    format: 'TikTok In-Feed Ad',
    constraints:
      'Overlay text: max 100 characters (short, punchy, visible on video). Caption: max 2200 characters. CTA: one of [Shop Now, Learn More, Sign Up, Download, Watch More].',
    jsonShape: `{ "overlayText": "...", "caption": "...", "cta": "..." }`,
  },
};

const OBJECTIVE_GUIDANCE: Record<string, string> = {
  conversions:
    'Focus on driving immediate action. Emphasize urgency, clear value proposition, and strong CTAs. Use social proof.',
  awareness:
    'Focus on brand recall and recognition. Lead with the brand story or unique value. Prioritize clarity and memorability over urgency.',
  engagement:
    'Focus on starting conversations and encouraging interaction. Use questions, bold claims, or relatable scenarios.',
  traffic:
    'Focus on curiosity and click-worthiness. Tease value behind the click without being clickbait. Clear destination benefit.',
  app_installs:
    'Focus on app benefits and ease of use. Highlight key features, ratings, or limited-time offers for download.',
};

function buildCreativeSystemPrompt(
  brand: BrandContext,
  platform: AdPlatform
): string {
  const spec = AD_PLATFORM_SPECS[platform];

  let prompt =
    `You are an expert ${spec.format} copywriter. You create high-converting ad copy ` +
    `that drives results while maintaining brand voice.`;

  if (brand.brandVoice) {
    prompt += `\n\nBrand Voice: ${brand.brandVoice}`;
  }
  if (brand.industry) {
    prompt += `\nIndustry: ${brand.industry}`;
  }
  if (brand.description) {
    prompt += `\nBusiness: ${brand.description}`;
  }
  if (brand.targetAudience && Object.keys(brand.targetAudience).length > 0) {
    prompt += `\nTarget Audience: ${JSON.stringify(brand.targetAudience)}`;
  }

  prompt += `\n\nPlatform constraints:\n${spec.constraints}`;

  prompt += `\n\nRules:
- Write in the brand's voice: "${brand.businessName}"
- Respect all character limits strictly
- Each variant should take a meaningfully different angle or hook
- Never use placeholder text — write real, ready-to-use copy
- Score each variant honestly on novelty, clarity, and CTA strength (0-1 scale)`;

  return prompt;
}

function buildCreativeUserPrompt(
  request: AdCreativeRequest,
  brand: BrandContext
): string {
  const variantCount = request.variantCount ?? 3;
  const spec = AD_PLATFORM_SPECS[request.platform];
  const objectiveGuide = OBJECTIVE_GUIDANCE[request.objective] ?? '';

  let prompt =
    `Create ${variantCount} unique ad creative variants for "${brand.businessName}".\n\n` +
    `Product/Service: ${request.productOrService}\n` +
    `Objective: ${request.objective}`;

  if (objectiveGuide) {
    prompt += `\nObjective guidance: ${objectiveGuide}`;
  }

  if (request.targetAudience) {
    prompt += `\nTarget Audience: ${request.targetAudience}`;
  }
  if (request.campaignTheme) {
    prompt += `\nCampaign Theme: ${request.campaignTheme}`;
  }
  if (request.cta) {
    prompt += `\nPreferred CTA: ${request.cta}`;
  }

  prompt += `\n\nRespond in JSON format:
{
  "variants": [
    {
      "creative": ${spec.jsonShape},
      "scores": {
        "novelty": 0.0-1.0,
        "clarity": 0.0-1.0,
        "ctaStrength": 0.0-1.0,
        "overall": 0.0-1.0
      },
      "recommendation": "Brief note on when/why to use this variant"
    }
  ]
}

Generate exactly ${variantCount} variants. Vary hooks, angles, and emotional triggers across variants.`;

  return prompt;
}

export async function generateAdCreative(
  request: AdCreativeRequest,
  brand: BrandContext
): Promise<AdCreativeResult> {
  const startTime = Date.now();

  const systemPrompt = buildCreativeSystemPrompt(brand, request.platform);
  const userPrompt = buildCreativeUserPrompt(request, brand);

  const response = await openai.chat.completions.create({
    model: AI_TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 4096,
  });

  const durationMs = Date.now() - startTime;
  const tokensInput = response.usage?.prompt_tokens ?? 0;
  const tokensOutput = response.usage?.completion_tokens ?? 0;

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content returned from ad creative generation');
  }

  const parsed = JSON.parse(content) as {
    variants: Array<{
      creative: Record<string, unknown>;
      scores: {
        novelty: number;
        clarity: number;
        ctaStrength: number;
        overall: number;
      };
      recommendation: string;
    }>;
  };

  const variants: AdCreativeVariant[] = parsed.variants.map((v) => ({
    platform: request.platform,
    creative: v.creative as unknown as AdCreativeVariant['creative'],
    scores: v.scores,
    recommendation: v.recommendation,
  }));

  return {
    variants,
    model: AI_TEXT_MODEL,
    tokensInput,
    tokensOutput,
    costCents: estimateModelCost(AI_TEXT_MODEL, tokensInput, tokensOutput),
    durationMs,
  };
}
