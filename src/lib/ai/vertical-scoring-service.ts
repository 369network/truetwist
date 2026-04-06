/**
 * Vertical Content Quality Scoring Service
 *
 * Uses GPT-4o-mini to evaluate how well generated content fits
 * industry-specific best practices for a given vertical.
 */

import { openai } from './openai-client';
import { AI_TEXT_MODEL } from './model-config';
import { VERTICAL_PROMPT_MODULES } from './vertical-prompts';
import type { VerticalScore } from './types';

export async function evaluateVerticalFit(
  content: string,
  industry: string,
  templateType: string
): Promise<VerticalScore> {
  const verticalModule = VERTICAL_PROMPT_MODULES[industry];
  if (!verticalModule) {
    return { score: 50, strengths: [], suggestions: ['No vertical module found for this industry.'] };
  }

  const systemPrompt = `You are a content quality evaluator specializing in ${industry} social media content.

Score the following content from 0-100 on how well it follows industry best practices.

Industry guidelines to evaluate against:
${verticalModule.systemInstructions}

Compliance requirements:
${verticalModule.complianceGuardrails}

Key terminology that should appear naturally: ${verticalModule.terminology.join(', ')}

Content template type: ${templateType}

Respond in JSON:
{
  "score": <number 0-100>,
  "strengths": ["strength1", "strength2"],
  "suggestions": ["suggestion1", "suggestion2"]
}

Scoring rubric:
- 90-100: Excellent vertical fit — uses industry terminology, follows compliance, matches style of top-performing content
- 70-89: Good fit — mostly aligned but missing some vertical-specific elements
- 50-69: Average — generic content that could apply to any industry
- 30-49: Below average — misses key industry conventions
- 0-29: Poor fit — violates compliance or completely off-target

Be specific in strengths and suggestions. Limit to 3 of each.`;

  const response = await openai.chat.completions.create({
    model: AI_TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Evaluate this ${industry} content:\n\n${content}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 512,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    return { score: 50, strengths: [], suggestions: ['Scoring unavailable — no response from evaluator.'] };
  }

  const parsed = JSON.parse(raw) as {
    score: number;
    strengths: string[];
    suggestions: string[];
  };

  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    strengths: parsed.strengths.slice(0, 3),
    suggestions: parsed.suggestions.slice(0, 3),
  };
}
