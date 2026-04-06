import { openai } from './openai-client';

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
  message?: string;
}

export async function moderateContent(text: string): Promise<ModerationResult> {
  const response = await openai.moderations.create({
    model: 'omni-moderation-latest',
    input: text,
  });

  const result = response.results[0];
  if (!result) {
    return { flagged: false, categories: [] };
  }

  const flaggedCategories = Object.entries(result.categories)
    .filter(([, flagged]) => flagged)
    .map(([category]) => category);

  return {
    flagged: result.flagged,
    categories: flaggedCategories,
    message: result.flagged
      ? `Content flagged for: ${flaggedCategories.join(', ')}`
      : undefined,
  };
}
