import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

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
    const body = await request.json();
    const { topic, tone, platforms, contentType } = body;

    if (!topic || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: "Topic and at least one platform are required" },
        { status: 400 }
      );
    }

    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Please add OPENAI_API_KEY to environment variables." },
        { status: 500 }
      );
    }

    // Generate content for each platform in parallel
    const results = await Promise.all(
      platforms.map(async (platform: string) => {
        const systemPrompt = `You are TrueTwist AI — an expert social media content creator. You generate viral, engaging, platform-optimized content that feels authentic and human-written (never generic or template-like).

CRITICAL RULES:
- Write REAL, SPECIFIC content about the topic. Never use placeholder text like [insert X] or generic filler.
- Every piece of content must be unique — if generating for multiple platforms, each must be genuinely different in approach, not just reformatted.
- Include specific details, examples, analogies, or mini-stories related to the topic.
- The content must be immediately publishable — no instructions to the user, no meta-commentary.
- Do NOT include hashtags in the main content body. Hashtags will be added separately.

${platformRules[platform] || ""}

TONE: ${toneInstructions[tone] || toneInstructions.Casual}`;

        const userPrompt = `Create ${contentType === "post" ? "a social media post" : contentType === "story" ? "a Story/Reel script" : contentType === "carousel" ? "a Carousel/Slides post" : "a Video Script"} about: "${topic}"

Platform: ${platform === "twitter" ? "X (Twitter)" : platform}

${contentTypeInstructions[contentType] || contentTypeInstructions.post}

Write the content now. Be specific to the topic "${topic}" — include real details, insights, or perspectives. Make it genuinely engaging and viral-worthy.`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.9,
          max_tokens: 1000,
        });

        const content = completion.choices[0]?.message?.content || "Failed to generate content";

        // Generate hashtags
        const hashtagCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Generate hashtags for a ${platform} post. Return ONLY a JSON array of hashtag strings (without the # symbol). Example: ["Fitness","HealthTips","Workout"]`,
            },
            {
              role: "user",
              content: `Generate 6-8 relevant, trending hashtags for a ${platform} post about "${topic}". Mix popular broad hashtags with niche specific ones.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 200,
        });

        let hashtags: string[] = [];
        try {
          const hashtagText = hashtagCompletion.choices[0]?.message?.content || "[]";
          // Extract JSON array from response
          const match = hashtagText.match(/\[[\s\S]*\]/);
          if (match) {
            hashtags = JSON.parse(match[0]);
          }
        } catch {
          // Fallback hashtags from topic
          hashtags = topic
            .split(/\s+/)
            .filter((w: string) => w.length > 2)
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .slice(0, 5);
        }

        return {
          id: Math.random().toString(36).slice(2),
          platform,
          content,
          hashtags,
          contentType,
        };
      })
    );

    return NextResponse.json({ posts: results });
  } catch (error: any) {
    console.error("Generate API error:", error);

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
