/**
 * AI model configuration — centralizes model selection and pricing.
 *
 * Model can be overridden via AI_TEXT_MODEL env var for A/B quality validation.
 * Pricing updates in one place when OpenAI changes rates.
 */

export interface ModelConfig {
  model: string;
  inputCostPerMillionTokens: number;  // in cents
  outputCostPerMillionTokens: number; // in cents
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 250, output: 1000 },       // $2.50 / $10.00 per 1M tokens
  'gpt-4o-mini': { input: 15, output: 60 },      // $0.15 / $0.60 per 1M tokens
};

/**
 * Returns the active text generation model config.
 * Override with AI_TEXT_MODEL env var (e.g. "gpt-4o" for quality validation).
 */
export function getTextModelConfig(): ModelConfig {
  const model = process.env.AI_TEXT_MODEL || 'gpt-4o-mini';
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['gpt-4o-mini'];

  return {
    model,
    inputCostPerMillionTokens: pricing.input,
    outputCostPerMillionTokens: pricing.output,
  };
}

/**
 * Estimates cost in cents for a given number of tokens.
 */
export function estimateTokenCost(
  inputTokens: number,
  outputTokens: number,
  config?: ModelConfig
): number {
  const { inputCostPerMillionTokens, outputCostPerMillionTokens } =
    config ?? getTextModelConfig();

  const inputCost = (inputTokens / 1_000_000) * inputCostPerMillionTokens;
  const outputCost = (outputTokens / 1_000_000) * outputCostPerMillionTokens;
  return Math.ceil(inputCost + outputCost);
}
