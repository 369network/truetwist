export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/ai/openai-client";
import { AI_TEXT_MODEL } from "@/lib/ai/model-config";
import { getAuthUser } from "@/middleware/auth";
import { scoreContent } from "@/lib/ai/content-quality-scoring";
import type { Platform } from "@/lib/social/types";

// Platform-specific rules from Strategist TRUA-7 design doc
const platformRules: Record<string, string> = {
  instagram: `Instagram rules:
- Max 2200 chars, but ideal under 150 for feed posts
- Use line breaks for readability
- Start with a hook in the first line (this shows before "...more")
- Use emojis sparingly but strategically
- End with a strong CTA
- For Reels/Stories: focus on visual storytelling, keep text overlays short`,

  twitter: `X (Twitter) rules:
- Max 280 characters for a single tweet
- If content is longer, format as a thread with numbered tweets
- Be punchy and concise
- Use line breaks between thoughts
- Controversial or surprising openers get more engagement
- Minimize emoji use — X culture prefers text-first`,

  facebook: `Facebook rules:
- Longer form content performs well (300-500 words)
- Conversational, community-driven tone
- Ask questions to drive comments
- Personal stories and anecdotes work best
- Use paragraphs, not bullet points
- Include a clear CTA for engagement`,

  linkedin: `LinkedIn rules:
- Professional but authentic tone
- Start with a bold statement or surprising stat
- Use short paragraphs (1-2 sentences each)
- Include relevant industry context
- End with a thought-provoking question
- Add 3-5 relevant hashtags at the end
- Optimal length: 1300-2000 characters`,

  tiktok: `TikTok rules:
- Super casual, Gen-Z friendly language
- Hook must be in the FIRST 2 seconds (first line)
- Use trending phrases and culture references
- Keep script under 60 seconds when read aloud
- Include visual/audio cues in brackets
- Make it feel spontaneous, not scripted
- End with a strong hook for follows/shares`,
};

// Content type instructions
const contentTypeInstructions: Record<string, string> = {
  post: `Generate a social media POST. Write the actual post content that can be directly copied and published. Include the text content only — no metadata or formatting labels.`,

  story: `Generate a STORY/REEL script with slide-by-slide breakdown:
- Slide 1: Hook (grab attention immediately)
- Slides 2-5: Main content points
- Slide 6: Key takeaway
- Slide 7: CTA
Format each slide with [SLIDE X — Title] followed by the text overlay and brief visual direction.
Include suggested audio/music style and any interactive elements (polls, questions, etc).`,

  carousel: `Generate a CAROUSEL/SLIDES post:
- Slide 1: Eye-catching cover title
- Slides 2-6: One key point per slide with brief explanation
- Slide 7: Summary of key points
- Slide 8: CTA slide
Format each slide with [Slide X] followed by the headline and body text.
Keep each slide's text concise (under 30 words per slide).
Include design suggestions.`,

  video: `Generate a VIDEO SCRIPT with timestamps:
- [0:00-0:03] Hook — must grab attention immediately
- [0:03-0:30] Main content — key points with transitions
- [0:30-0:50] Deep dive or examples
- [0:50-0:55] Key takeaway
- [0:55-1:00] CTA
Include on-screen text suggestions, b-roll ideas, and delivery notes.`,
};

// Tone instructions
const toneInstructions: Record<string, string> = {
  Professional: "Use a polished, authoritative tone. Include data points or industry insights where relevant. Sound like a thought leader.",
  Casual: "Write like you're talking to a friend. Use conversational language, contractions, and relatable examples. Keep it real and approachable.",
  Witty: "Be clever, humorous, and entertaining. Use wordplay, unexpected comparisons, and a playful voice. Make people smile while learning.",
  Inspirational: "Be motivating and uplifting. Use powerful language that inspires action. Share a vision of what's possible. Make people feel empowered.",
  Educational: "Focus on teaching and informing. Break down complex ideas simply. Use facts, examples, and step-by-step explanations. Be the helpful expert.",
  Controversial: "Take a bold, contrarian stance. Challenge conventional wisdom. Be provocative but thoughtful. Start debates and encourage discussion.",
};

export async function POST(request: NextRequest) {
  try {
    // Auth check
    getAuthUser(request);

    const body = await request.json();
    const { topic, tone, platforms, contentType } = body;

    if (!topic || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: "Topic and at least one platform are required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Please add OPENAI_API_KEY to environment variables." },
        { status: 500 }
      );
    }

    // Generate content, hashtags, and viral analysis in a single unified API call per platform
    // (~66% latency reduction vs 3 sequential calls, ~30% cost reduction)
    const results = await Promise.all(
      platforms.map(async (platform: string) => {
        const systemPrompt = `You are TrueTwist AI — an expert social media content creator and analyst. You generate viral, engaging, platform-optimized content that feels authentic and human-written.

CRITICAL RULES:
- Write REAL, SPECIFIC content about the topic. Never use placeholder text like [insert X] or generic filler.
- Every piece of content must be unique — if generating for multiple platforms, each must be genuinely different in approach, not just reformatted.
- Include specific details, examples, analogies, or mini-stories related to the topic.
- The content must be immediately publishable — no instructions to the user, no meta-commentary.
- Do NOT include hashtags in the main content body. Hashtags will be added separately.

${platformRules[platform] || ""}

TONE: ${toneInstructions[tone] || toneInstructions.Casual}`;

        const contentTypeName = contentType === "post" ? "a social media post" : contentType === "story" ? "a Story/Reel script" : contentType === "carousel" ? "a Carousel/Slides post" : "a Video Script";

        const userPrompt = `Create ${contentTypeName} about: "${topic}"

Platform: ${platform === "twitter" ? "X (Twitter)" : platform}

${contentTypeInstructions[contentType] || contentTypeInstructions.post}

After writing the content, also provide:
1. 6-8 relevant hashtags (without # symbol, mix popular and niche)
2. A viral score (1-100) analyzing the content's viral potential
3. 3 viral strengths
4. 2 improvement suggestions
5. An alternative opening hook for A/B testing

Respond in this exact JSON format:
{
  "content": "the full post content here",
  "hashtags": ["Tag1", "Tag2", "Tag3"],
  "viralScore": 75,
  "viralFactors": ["strength1", "strength2", "strength3"],
  "improvements": ["suggestion1", "suggestion2"],
  "alternativeHook": "an alternative opening line"
}`;

        const completion = await openai.chat.completions.create({
          model: AI_TEXT_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.9,
          max_tokens: 1500,
        });

        const raw = completion.choices[0]?.message?.content || "{}";
        let content = "";
        let hashtags: string[] = [];
        let viralScore = 50;
        let viralFactors: string[] = [];
        let improvements: string[] = [];
        let alternativeHook = "";

        try {
          const parsed = JSON.parse(raw);
          content = parsed.content || "Failed to generate content";
          hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
          viralScore = typeof parsed.viralScore === "number" ? parsed.viralScore : 50;
          viralFactors = Array.isArray(parsed.viralFactors) ? parsed.viralFactors : [];
          improvements = Array.isArray(parsed.improvements) ? parsed.improvements : [];
          alternativeHook = parsed.alternativeHook || "";
        } catch {
          content = raw;
          console.warn("Failed to parse unified AI response as JSON, using raw text");
        }

        // Run local quality scoring (zero API cost)
        const qualityScore = scoreContent(content, platform as Platform);

        return {
          id: Math.random().toString(36).slice(2),
          platform,
          content,
          hashtags,
          contentType,
          viralScore,
          viralFactors,
          improvements,
          alternativeHook,
          qualityScore,
        };
      })
    );

    return NextResponse.json({ posts: results });
  } catch (error: any) {
    console.error("Generate API error:", error);

    if (error?.statusCode === 401 || error?.message?.includes('unauthorized')) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (error?.status === 401 || error?.code === "invalid_api_key") {
      return NextResponse.json(
        { error: "Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable." },
        { status: 401 }
      );
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: error?.message || "Failed to generate content" },
      { status: 500 }
    );
  }
}
