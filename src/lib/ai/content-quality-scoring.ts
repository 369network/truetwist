/**
 * Content Quality Scoring Module
 *
 * Scores generated content across 5 heuristic dimensions without API calls (zero cost).
 * Runs locally for instant feedback on content quality.
 */

import type { Platform } from "@/lib/social/types";
import { PLATFORM_CONSTRAINTS } from "@/lib/social/types";

export interface QualityScore {
  overall: number; // 0-100 weighted composite
  readability: number; // 0-100
  hookStrength: number; // 0-100
  ctaClarity: number; // 0-100
  platformFit: number; // 0-100
  authenticity: number; // 0-100
  suggestions: string[];
}

// Dimension weights (must sum to 1)
const WEIGHTS = {
  readability: 0.2,
  hookStrength: 0.25,
  ctaClarity: 0.2,
  platformFit: 0.2,
  authenticity: 0.15,
};

// CTA signal words/phrases
const CTA_PATTERNS = [
  /\blink in bio\b/i,
  /\bswipe\b/i,
  /\bfollow\b/i,
  /\bshare\b/i,
  /\bcomment\b/i,
  /\bsubscribe\b/i,
  /\bclick\b/i,
  /\bsave this\b/i,
  /\bcheck out\b/i,
  /\btag\b/i,
  /\bdm\b/i,
  /\bsign up\b/i,
  /\blearn more\b/i,
  /\bget started\b/i,
  /\btry\b/i,
  /\bjoin\b/i,
  /\bdownload\b/i,
  /\bshop\b/i,
  /\bgrab\b/i,
  /\bclaim\b/i,
  /\?$/,
  /\?\s/, // questions drive engagement
];

// Hook patterns that indicate strong openings
const HOOK_PATTERNS = [
  /^(stop|wait|here'?s|this|the|i |my |you |we |if |what |how |why |most |nobody |everyone |imagine )/i,
  /^\d+/, // starts with number
  /^[A-Z\s]{4,}/, // ALL CAPS hook
  /^["'""].*["'""]/, // opens with quote
  /\?/, // question in first line
  /^🔥|^⚡|^💡|^🚨|^👀|^❌|^✅/, // emoji hooks
];

// Generic/corporate filler phrases that reduce authenticity
const GENERIC_PHRASES = [
  /\bin today's (world|landscape|digital|fast-paced)\b/i,
  /\bgame.?changer\b/i,
  /\bsynergy\b/i,
  /\bleverage\b/i,
  /\bparadigm\b/i,
  /\bunlock (your|the) (potential|power)\b/i,
  /\btake it to the next level\b/i,
  /\bdon't miss out\b/i,
  /\blimited time\b/i,
  /\bact now\b/i,
  /\b(amazing|incredible|revolutionary|groundbreaking) (opportunity|solution)\b/i,
];

export function scoreContent(text: string, platform: Platform): QualityScore {
  const suggestions: string[] = [];

  const readability = scoreReadability(text, suggestions);
  const hookStrength = scoreHookStrength(text, platform, suggestions);
  const ctaClarity = scoreCtaClarity(text, platform, suggestions);
  const platformFit = scorePlatformFit(text, platform, suggestions);
  const authenticity = scoreAuthenticity(text, suggestions);

  const overall = Math.round(
    WEIGHTS.readability * readability +
      WEIGHTS.hookStrength * hookStrength +
      WEIGHTS.ctaClarity * ctaClarity +
      WEIGHTS.platformFit * platformFit +
      WEIGHTS.authenticity * authenticity,
  );

  return {
    overall,
    readability,
    hookStrength,
    ctaClarity,
    platformFit,
    authenticity,
    suggestions,
  };
}

function scoreReadability(text: string, suggestions: string[]): number {
  let score = 70; // base

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const avgWordsPerSentence =
    sentences.length > 0 ? words.length / sentences.length : words.length;

  // Ideal sentence length for social: 8-15 words
  if (avgWordsPerSentence <= 15) score += 15;
  else if (avgWordsPerSentence <= 20) score += 5;
  else {
    score -= 10;
    suggestions.push(
      "Shorten sentences for better readability (aim for 8-15 words).",
    );
  }

  // Line breaks improve scannability
  const lineBreaks = (text.match(/\n/g) || []).length;
  if (lineBreaks >= 2) score += 10;
  else if (text.length > 200) {
    suggestions.push("Add line breaks to improve scannability.");
  }

  // Emoji usage (moderate is good)
  // Simple emoji detection - count common emoji characters
  // Using a basic approach that works across environments
  const emojiPatterns = [
    /😀|😃|😄|😁|😆|😅|😂|🤣|🥲|☺️|😊|😇|🙂|🙃|😉|😌|😍|🥰|😘|😗|😙|😚|😋|😛|😝|😜|🤪|🤨|🧐|🤓|😎|🤩|🥳|😏|😒|😞|😔|😟|😕|🙁|☹️|😣|😖|😫|😩|🥺|😢|😭|😤|😠|😡|🤬|🤯|😳|🥵|🥶|😱|😨|😰|😥|😓|🤗|🤔|🤭|🤫|🤥|😶|😐|😑|😬|🙄|😯|😦|😧|😮|😲|🥱|😴|🤤|😪|😵|🤐|🥴|🤢|🤮|🤧|😷|🤒|🤕|🤑|🤠|😈|👿|👹|👺|🤡|💩|👻|💀|☠️|👽|👾|🤖|🎃|😺|😸|😹|😻|😼|😽|🙀|😿|😾/g,
    /👋|🤚|🖐|✋|🖖|👌|🤌|🤏|✌️|🤞|🤟|🤘|🤙|👈|👉|👆|🖕|👇|☝️|👍|👎|✊|👊|🤛|🤜|👏|🙌|👐|🤲|🤝|🙏|✍️|💅|🤳|💪|🦾|🦿|🦵|🦶|👂|🦻|👃|🧠|🦷|🦴|👀|👁|👅|👄|💋|🩸/g,
    /👶|👧|🧒|👦|👩|🧑|👨|👩‍🦱|🧑‍🦱|👨‍🦱|👩‍🦰|🧑‍🦰|👨‍🦰|👱‍♀️|👱|👱‍♂️|👩‍🦳|🧑‍🦳|👨‍🦳|👩‍🦲|🧑‍🦲|👨‍🦲|🧔|👵|🧓|👴|👲|👳‍♀️|👳|👳‍♂️|🧕|👮‍♀️|👮|👮‍♂️|👷‍♀️|👷|👷‍♂️|💂‍♀️|💂|💂‍♂️|🕵️‍♀️|🕵️|🕵️‍♂️|👩‍⚕️|🧑‍⚕️|👨‍⚕️|👩‍🌾|🧑‍🌾|👨‍🌾|👩‍🍳|🧑‍🍳|👨‍🍳|👩‍🎓|🧑‍🎓|👨‍🎓|👩‍🎤|🧑‍🎤|👨‍🎤|👩‍🏫|🧑‍🏫|👨‍🏫|👩‍🏭|🧑‍🏭|👨‍🏭|👩‍💻|🧑‍💻|👨‍💻|👩‍💼|🧑‍💼|👨‍💼|👩‍🔧|🧑‍🔧|👨‍🔧|👩‍🔬|🧑‍🔬|👨‍🔬|👩‍🎨|🧑‍🎨|👨‍🎨|👩‍🚒|🧑‍🚒|👨‍🚒|👩‍✈️|🧑‍✈️|👨‍✈️|👩‍🚀|🧑‍🚀|👨‍🚀|👩‍⚖️|🧑‍⚖️|👨‍⚖️|👰‍♀️|👰|👰‍♂️|🤵‍♀️|🤵|🤵‍♂️|👸|🤴|🥷|🦸‍♀️|🦸|🦸‍♂️|🦹‍♀️|🦹|🦹‍♂️|🤶|🧑‍🎄|🎅|🧙‍♀️|🧙|🧙‍♂️|🧚‍♀️|🧚|🧚‍♂️|🧛‍♀️|🧛|🧛‍♂️|🧜‍♀️|🧜|🧜‍♂️|🧝‍♀️|🧝|🧝‍♂️|🧞‍♀️|🧞|🧞‍♂️|🧟‍♀️|🧟|🧟‍♂️|💆‍♀️|💆|💆‍♂️|💇‍♀️|💇|💇‍♂️|🚶‍♀️|🚶|🚶‍♂️|🧍‍♀️|🧍|🧍‍♂️|🧎‍♀️|🧎|🧎‍♂️|👨‍🦯|🧑‍🦯|👩‍🦯|👨‍🦼|🧑‍🦼|👩‍🦼|👨‍🦽|🧑‍🦽|👩‍🦽|🏃‍♀️|🏃|🏃‍♂️|💃|🕺|🕴️|👯‍♀️|👯|👯‍♂️|🧖‍♀️|🧖|🧖‍♂️|🧗‍♀️|🧗|🧗‍♂️|🤺|🏇|⛷️|🏂|🏌️‍♀️|🏌️|🏌️‍♂️|🏄‍♀️|🏄|🏄‍♂️|🚣‍♀️|🚣|🚣‍♂️|🏊‍♀️|🏊|🏊‍♂️|⛹️‍♀️|⛹️|⛹️‍♂️|🏋️‍♀️|🏋️|🏋️‍♂️|🚴‍♀️|🚴|🚴‍♂️|🚵‍♀️|🚵|🚵‍♂️|🤸‍♀️|🤸|🤸‍♂️|🤽‍♀️|🤽|🤽‍♂️|🤾‍♀️|🤾|🤾‍♂️|🤹‍♀️|🤹|🤹‍♂️|🧘‍♀️|🧘|🧘‍♂️|🛀|🛌|🧑‍🤝‍🧑|👭|👫|👬|💏|💑|👪/g,
    /🙈|🙉|🙊|💥|💫|💦|💨|🕳️|💣|💬|👁️‍🗨️|🗨️|🗯️|💭|💤/g,
  ];

  let emojiCount = 0;
  for (const pattern of emojiPatterns) {
    const matches = text.match(pattern) || [];
    emojiCount += matches.length;
  }
  if (emojiCount >= 1 && emojiCount <= 5) score += 5;
  else if (emojiCount > 8) {
    score -= 5;
    suggestions.push("Too many emojis — use 2-5 for best engagement.");
  }

  return clamp(score);
}

function scoreHookStrength(
  text: string,
  platform: Platform,
  suggestions: string[],
): number {
  let score = 40; // base — hooks need to earn their points

  const firstLine = text.split(/\n/)[0].trim();
  if (!firstLine) return 20;

  // Pattern matching for strong hooks
  const matchedPatterns = HOOK_PATTERNS.filter((p) => p.test(firstLine));
  score += matchedPatterns.length * 12;

  // Short first line is better (shows fully in feeds)
  if (firstLine.length <= 80) score += 10;
  else if (firstLine.length > 150) {
    score -= 10;
    suggestions.push(
      "Hook is too long — keep first line under 80 characters for feed visibility.",
    );
  }

  // Platform-specific hook scoring
  if (platform === "twitter" && firstLine.length <= 100) score += 5;
  if (
    platform === "tiktok" &&
    /^(stop|wait|pov|this|you won'?t)/i.test(firstLine)
  )
    score += 10;

  if (score < 50) {
    suggestions.push(
      "Strengthen your opening hook — try a question, bold claim, or number.",
    );
  }

  return clamp(score);
}

function scoreCtaClarity(
  text: string,
  platform: Platform,
  suggestions: string[],
): number {
  let score = 30; // base

  const matchedCtas = CTA_PATTERNS.filter((p) => p.test(text));
  score += matchedCtas.length * 10;

  // CTA should be near the end for best conversion
  const lines = text.split(/\n/).filter((l) => l.trim().length > 0);
  if (lines.length > 1) {
    const lastThird = lines.slice(Math.floor(lines.length * 0.66)).join(" ");
    const ctaInEnd = CTA_PATTERNS.some((p) => p.test(lastThird));
    if (ctaInEnd) score += 15;
  }

  if (matchedCtas.length === 0) {
    suggestions.push(
      "Add a clear call-to-action (comment, share, save, link in bio).",
    );
  }

  return clamp(score);
}

function scorePlatformFit(
  text: string,
  platform: Platform,
  suggestions: string[],
): number {
  let score = 60; // base

  const constraints = PLATFORM_CONSTRAINTS[platform];
  if (!constraints) return score;

  // Character count fit
  const charRatio = text.length / constraints.maxTextLength;
  if (charRatio <= 1) {
    // Under limit — good. Optimal zone is 40-80% of limit
    if (charRatio >= 0.4 && charRatio <= 0.8) score += 20;
    else if (charRatio >= 0.2) score += 10;
    else {
      score -= 5;
      suggestions.push(
        `Content is very short for ${platform}. Consider adding more detail.`,
      );
    }
  } else {
    score -= 20;
    suggestions.push(
      `Content exceeds ${platform} character limit (${text.length}/${constraints.maxTextLength}).`,
    );
  }

  // Hashtag count fit
  const hashtagCount = (text.match(/#\w+/g) || []).length;
  if (hashtagCount <= constraints.maxHashtags) score += 10;
  else {
    score -= 10;
    suggestions.push(
      `Too many hashtags for ${platform} (max ${constraints.maxHashtags}).`,
    );
  }

  // Platform-specific patterns
  if (platform === "linkedin" && text.length >= 1000) score += 10; // LinkedIn rewards long-form
  if (platform === "twitter" && text.length <= 250) score += 10; // Twitter rewards brevity
  if (platform === "tiktok" && /\[.*\]/g.test(text)) score += 5; // Visual cues for TikTok

  return clamp(score);
}

function scoreAuthenticity(text: string, suggestions: string[]): number {
  let score = 80; // start high, deduct for generic patterns

  const matchedGeneric = GENERIC_PHRASES.filter((p) => p.test(text));
  score -= matchedGeneric.length * 8;

  // Specificity bonus: numbers, names, concrete details
  if (/\d+%|\$\d+|\d+ (people|users|customers|followers)/i.test(text))
    score += 10;

  // First-person narrative signals authenticity
  if (/\b(I|my|we|our)\b/i.test(text)) score += 5;

  // Excessive exclamation marks feel fake
  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations > 3) {
    score -= 5;
    suggestions.push("Reduce exclamation marks — too many feel inauthentic.");
  }

  if (matchedGeneric.length > 2) {
    suggestions.push(
      "Replace generic marketing phrases with specific, authentic language.",
    );
  }

  return clamp(score);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
