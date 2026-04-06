import type { Platform } from '@/lib/social/types';

export interface QualityDimensions {
  readability: number;    // 0-100: sentence length, vocabulary complexity
  hookStrength: number;   // 0-100: opening line engagement potential
  ctaClarity: number;     // 0-100: call-to-action presence and clarity
  platformFit: number;    // 0-100: adherence to platform best practices
  authenticity: number;   // 0-100: how natural/non-generic the content feels
}

export interface ContentQualityResult {
  overallScore: number;       // 0-100 weighted composite
  dimensions: QualityDimensions;
  suggestions: string[];
}

// Platform-specific character limits for fitness scoring
const PLATFORM_IDEAL_LENGTH: Record<string, { min: number; max: number }> = {
  instagram: { min: 50, max: 150 },
  twitter: { min: 20, max: 280 },
  facebook: { min: 200, max: 500 },
  linkedin: { min: 300, max: 2000 },
  tiktok: { min: 30, max: 200 },
  youtube: { min: 100, max: 5000 },
  pinterest: { min: 50, max: 500 },
  threads: { min: 20, max: 500 },
};

// Weights for composite score
const DIMENSION_WEIGHTS = {
  readability: 0.20,
  hookStrength: 0.30,
  ctaClarity: 0.15,
  platformFit: 0.20,
  authenticity: 0.15,
};

/**
 * Computes a deterministic content quality score using text analysis heuristics.
 * This runs locally (no API call) to provide instant quality feedback.
 */
export function scoreContent(
  text: string,
  platform: Platform,
  hashtags: string[] = []
): ContentQualityResult {
  const suggestions: string[] = [];

  const readability = computeReadability(text, suggestions);
  const hookStrength = computeHookStrength(text, platform, suggestions);
  const ctaClarity = computeCtaClarity(text, suggestions);
  const platformFit = computePlatformFit(text, platform, hashtags, suggestions);
  const authenticity = computeAuthenticity(text, suggestions);

  const dimensions: QualityDimensions = {
    readability,
    hookStrength,
    ctaClarity,
    platformFit,
    authenticity,
  };

  const overallScore = Math.round(
    DIMENSION_WEIGHTS.readability * readability +
    DIMENSION_WEIGHTS.hookStrength * hookStrength +
    DIMENSION_WEIGHTS.ctaClarity * ctaClarity +
    DIMENSION_WEIGHTS.platformFit * platformFit +
    DIMENSION_WEIGHTS.authenticity * authenticity
  );

  return { overallScore, dimensions, suggestions };
}

function computeReadability(text: string, suggestions: string[]): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) return 0;

  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : words.length;
  const avgWordLength = words.reduce((sum, w) => sum + w.replace(/[^a-zA-Z]/g, '').length, 0) / words.length;

  // Optimal: 10-20 words per sentence for social media
  let sentenceScore: number;
  if (avgWordsPerSentence <= 20) {
    sentenceScore = 100;
  } else if (avgWordsPerSentence <= 30) {
    sentenceScore = 80 - (avgWordsPerSentence - 20) * 2;
  } else {
    sentenceScore = 50;
    suggestions.push('Shorten your sentences for better readability on social media');
  }

  // Optimal: 4-6 chars per word average
  let wordScore: number;
  if (avgWordLength <= 6) {
    wordScore = 100;
  } else if (avgWordLength <= 8) {
    wordScore = 80;
  } else {
    wordScore = 60;
    suggestions.push('Use simpler vocabulary for broader appeal');
  }

  // Check for line breaks (important for social)
  const hasLineBreaks = text.includes('\n');
  const lineBreakBonus = hasLineBreaks ? 10 : 0;

  return clamp(Math.round((sentenceScore * 0.5 + wordScore * 0.5) + lineBreakBonus), 0, 100);
}

function computeHookStrength(text: string, platform: string, suggestions: string[]): number {
  const firstLine = text.split('\n')[0]?.trim() || '';
  let score = 50;

  // Strong hooks tend to be short and punchy
  if (firstLine.length > 0 && firstLine.length <= 80) score += 10;
  if (firstLine.length > 0 && firstLine.length <= 50) score += 5;

  // Question hooks
  if (firstLine.includes('?')) score += 10;

  // Number/stat hooks
  if (/\d+%|\d+\s*(x|times|ways|tips|steps|secrets|reasons)/i.test(firstLine)) score += 15;

  // Power words in hook
  const powerWords = /stop|imagine|secret|truth|mistake|never|always|must|surprising|shocking|proven|instantly|guaranteed/i;
  if (powerWords.test(firstLine)) score += 10;

  // Emoji in hook (good for Instagram/TikTok, less so for LinkedIn)
  // Check for common emoji ranges via surrogate pairs
  const hasEmoji = /\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F\uDE80-\uDEFF]|\u2600-\u26FF/.test(firstLine);
  if (hasEmoji && (platform === 'instagram' || platform === 'tiktok')) score += 5;

  // Penalize weak hooks
  if (/^(hi|hello|hey|good morning|check out)/i.test(firstLine)) {
    score -= 15;
    suggestions.push('Start with a stronger hook — avoid generic greetings');
  }

  if (firstLine.length === 0) {
    score = 0;
    suggestions.push('Add a compelling opening hook');
  }

  return clamp(score, 0, 100);
}

function computeCtaClarity(text: string, suggestions: string[]): number {
  const lastThird = text.slice(Math.floor(text.length * 0.66));
  let score = 30;

  // Check for CTA patterns
  const ctaPatterns = /follow|subscribe|share|comment|like|save|click|link|tap|dm|reply|tag|join|sign up|download|learn more|read more|try|check out|visit|book|order|grab|get started/i;

  if (ctaPatterns.test(lastThird)) {
    score += 40;
  } else if (ctaPatterns.test(text)) {
    score += 20;
  } else {
    suggestions.push('Add a clear call-to-action at the end of your post');
  }

  // Question at the end drives engagement
  if (text.trim().endsWith('?')) score += 15;

  // Urgency words
  if (/now|today|limited|don't miss|before|hurry|last chance/i.test(lastThird)) {
    score += 15;
  }

  return clamp(score, 0, 100);
}

function computePlatformFit(
  text: string,
  platform: Platform,
  hashtags: string[],
  suggestions: string[]
): number {
  const ideal = PLATFORM_IDEAL_LENGTH[platform];
  if (!ideal) return 70;

  let score = 50;
  const len = text.length;

  // Length fitness
  if (len >= ideal.min && len <= ideal.max) {
    score += 30;
  } else if (len < ideal.min) {
    score += 10;
    suggestions.push(`Content is short for ${platform} (ideal: ${ideal.min}-${ideal.max} chars)`);
  } else if (len <= ideal.max * 1.5) {
    score += 20;
  } else {
    suggestions.push(`Content may be too long for ${platform} (ideal: ${ideal.min}-${ideal.max} chars)`);
  }

  // Hashtag count
  const hashtagCount = hashtags.length;
  if (platform === 'instagram' && hashtagCount >= 5 && hashtagCount <= 15) score += 10;
  else if (platform === 'twitter' && hashtagCount >= 1 && hashtagCount <= 3) score += 10;
  else if (platform === 'linkedin' && hashtagCount >= 3 && hashtagCount <= 5) score += 10;
  else if (hashtagCount >= 3 && hashtagCount <= 8) score += 5;

  // Platform-specific checks
  if (platform === 'twitter' && len > 280) {
    score -= 20;
    suggestions.push('Tweet exceeds 280 character limit');
  }

  if (platform === 'linkedin' && !/\n/.test(text)) {
    suggestions.push('Use short paragraphs with line breaks for LinkedIn');
  }

  return clamp(score, 0, 100);
}

function computeAuthenticity(text: string, suggestions: string[]): number {
  let score = 70;

  // Penalize placeholder/generic patterns
  const genericPatterns = /\[insert|\[your|\[brand|lorem ipsum|placeholder|sample text/i;
  if (genericPatterns.test(text)) {
    score -= 40;
    suggestions.push('Remove placeholder text — content should be ready to publish');
  }

  // Penalize overly corporate/generic phrases
  const corporateSpeak = /leverage|synergy|paradigm shift|thought leader|value proposition|circle back|move the needle|low-hanging fruit/i;
  if (corporateSpeak.test(text)) {
    score -= 10;
    suggestions.push('Replace corporate jargon with conversational language');
  }

  // Reward specificity (numbers, names, concrete details)
  const hasNumbers = /\d+/.test(text);
  const hasQuotes = /"[^"]{5,}"/.test(text);
  if (hasNumbers) score += 10;
  if (hasQuotes) score += 10;

  // Reward varied punctuation (shows expressive writing)
  const hasQuestion = text.includes('?');
  const hasExclamation = text.includes('!');
  const hasDash = /—|-/.test(text);
  if (hasQuestion) score += 5;
  if (hasExclamation) score += 3;
  if (hasDash) score += 2;

  return clamp(score, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
