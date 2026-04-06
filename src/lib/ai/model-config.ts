/**
 * Centralized AI model configuration.
 * Use AI_TEXT_MODEL env var to toggle between models for A/B quality validation.
 * Default: gpt-4o-mini (~94% cost savings vs gpt-4o with comparable social media quality).
 */

export type TextModel = 'gpt-4o' | 'gpt-4o-mini';

export const AI_TEXT_MODEL: TextModel =
  (process.env.AI_TEXT_MODEL as TextModel) || 'gpt-4o-mini';

// Pricing per 1M tokens (in cents)
export const MODEL_PRICING: Record<TextModel, { inputPer1M: number; outputPer1M: number }> = {
  'gpt-4o': { inputPer1M: 250, outputPer1M: 1000 },      // $2.50 / $10.00
  'gpt-4o-mini': { inputPer1M: 15, outputPer1M: 60 },     // $0.15 / $0.60
};

export function estimateModelCost(
  model: TextModel,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return Math.ceil(inputCost + outputCost);
}
