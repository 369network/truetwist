"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

const tones = ["Professional", "Casual", "Witty", "Inspirational", "Educational", "Controversial"];
const platformList = ["instagram", "twitter", "facebook", "linkedin", "tiktok"];

export default function GeneratePage() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Casual");
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "twitter"]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<any[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const supabase = createClient();

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    await new Promise(r => setTimeout(r, 1500));
    const posts = platforms.map(platform => ({
      id: Math.random().toString(36).slice(2),
      platform,
      content: generateContent(topic.trim(), tone, platform),
      hashtags: generateSmartHashtags(topic.trim(), platform),
    }));
    setGenerated(posts);
    setGenerating(false);
  };

  const savePost = async (post: any) => {
    setSaving(post.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("posts").insert({
      user_id: user.id,
      content: post.content,
      hashtags: post.hashtags,
      platforms: [post.platform],
      status: "draft",
      ai_prompt: topic,
    });
    setSaving(null);
    alert("Post saved as draft!");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const regenerate = () => {
    if (topic.trim()) handleGenerate();
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">AI Content Generator</h1>
      <p className="text-sm mb-8" style={{ color: "var(--tt-text-muted)" }}>Describe your topic and let AI create scroll-stopping content for you.</p>

      {/* Input */}
      <div className="p-6 rounded-2xl mb-6" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        <label className="block text-sm font-medium mb-2">What do you want to post about?</label>
        <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., car bike comparison, fitness tips for beginners, new product launch, travel photography..." rows={3} className="input-field resize-none mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Tone</label>
            <div className="flex flex-wrap gap-2">
              {tones.map(t => (
                <button key={t} onClick={() => setTone(t)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{
                  background: tone === t ? "rgba(99,102,241,0.2)" : "var(--tt-surface-2)",
                  color: tone === t ? "#a5b4fc" : "var(--tt-text-muted)",
                  border: tone === t ? "1px solid rgba(99,102,241,0.4)" : "1px solid var(--tt-border)",
                }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {platformList.map(p => (
                <button key={p} onClick={() => togglePlatform(p)} className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition" style={{
                  background: platforms.includes(p) ? "rgba(99,102,241,0.2)" : "var(--tt-surface-2)",
                  color: platforms.includes(p) ? "#a5b4fc" : "var(--tt-text-muted)",
                  border: platforms.includes(p) ? "1px solid rgba(99,102,241,0.4)" : "1px solid var(--tt-border)",
                }}>{p === "twitter" ? "X" : p}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleGenerate} disabled={generating || !topic.trim()} className="px-6 py-3 rounded-xl text-white font-semibold transition hover:-translate-y-0.5 disabled:opacity-50" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Generating...
              </span>
            ) : "✨ Generate Content"}
          </button>
          {generated.length > 0 && (
            <button onClick={regenerate} disabled={generating} className="px-4 py-3 rounded-xl text-sm font-medium transition hover:-translate-y-0.5 disabled:opacity-50" style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)" }}>
              🔄 Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {generated.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Generated Content for &ldquo;{topic}&rdquo;</h2>
          {generated.map(post => (
            <div key={post.id} className="p-5 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full text-xs font-medium capitalize" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                  {post.platform === "twitter" ? "X (Twitter)" : post.platform}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => copyToClipboard(post.content + "\n\n" + post.hashtags.map((h: string) => "#" + h).join(" "))} className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
                    📋 Copy
                  </button>
                  <button onClick={() => savePost(post)} disabled={saving === post.id} className="px-4 py-1.5 rounded-lg text-xs font-medium transition" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                    {saving === post.id ? "Saving..." : "💾 Save as Draft"}
                  </button>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {post.hashtags.map((h: string, i: number) => (
                  <span key={i} className="text-xs" style={{ color: "#818cf8" }}>#{h}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Smart Content Generation Engine
// Generates truly topic-relevant content based on topic, tone, and platform
// ============================================================

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleAndPick<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateContent(topic: string, tone: string, platform: string): string {
  const topicTitle = topic.split(/\s+/).map(w => capitalize(w.toLowerCase())).join(" ");
  const topicLower = topic.toLowerCase();

  // Extract key concepts from topic
  const words = topic.split(/\s+/).filter(w => w.length > 2);
  const keyPhrase = topic.length > 40 ? topic.slice(0, 40) + "..." : topic;

  // Generate tone-specific openers, bodies, and closers
  const toneStyles = getToneStyle(tone, topicTitle, topicLower, words);

  // Platform-specific formatting
  switch (platform) {
    case "instagram":
      return generateInstagram(topicTitle, topicLower, toneStyles, words);
    case "twitter":
      return generateTwitter(topicTitle, topicLower, toneStyles, words);
    case "facebook":
      return generateFacebook(topicTitle, topicLower, toneStyles, words);
    case "linkedin":
      return generateLinkedin(topicTitle, topicLower, toneStyles, words);
    case "tiktok":
      return generateTikTok(topicTitle, topicLower, toneStyles, words);
    default:
      return generateInstagram(topicTitle, topicLower, toneStyles, words);
  }
}

interface ToneStyle {
  openers: string[];
  hooks: string[];
  ctas: string[];
  tips: string[];
  insights: string[];
}

function getToneStyle(tone: string, topicTitle: string, topicLower: string, words: string[]): ToneStyle {
  const mainWord = words[0] || topicTitle;
  const secondWord = words[1] || "";

  const styles: Record<string, ToneStyle> = {
    Professional: {
      openers: [
        `Here's what industry experts are saying about ${topicLower}`,
        `A data-driven look at ${topicLower} and why it matters`,
        `The evolving landscape of ${topicLower} — key insights`,
        `Understanding ${topicLower}: what professionals need to know`,
      ],
      hooks: [
        `The ${topicLower} space is undergoing rapid transformation.`,
        `If you're not paying attention to ${topicLower}, you're falling behind.`,
        `${topicTitle} has become a critical factor in today's market.`,
        `Let's break down what's driving the ${topicLower} conversation forward.`,
      ],
      ctas: [
        `What's your perspective on ${topicLower}? Share your thoughts below.`,
        `Follow for more insights on ${topicLower} and industry trends.`,
        `Save this for your next strategy session on ${topicLower}.`,
        `Tag someone who needs to see this take on ${topicLower}.`,
      ],
      tips: [
        `Research the latest trends in ${topicLower} before making decisions`,
        `Benchmark your ${topicLower} approach against industry leaders`,
        `Build a comprehensive strategy around ${topicLower}`,
        `Measure and iterate on your ${topicLower} performance regularly`,
        `Stay updated on emerging developments in ${topicLower}`,
      ],
      insights: [
        `${topicTitle} is reshaping how businesses operate and compete`,
        `Early adopters of ${topicLower} strategies are seeing measurable results`,
        `The ROI of investing in ${topicLower} knowledge is significant`,
        `${topicTitle} expertise is becoming a high-demand skill in the market`,
      ],
    },
    Casual: {
      openers: [
        `Let's talk about ${topicLower} for a sec`,
        `Okay but can we discuss ${topicLower}?`,
        `Real talk about ${topicLower}`,
        `${topicTitle} — here's my honest take`,
      ],
      hooks: [
        `I've been deep-diving into ${topicLower} lately and wow, there's a lot to unpack.`,
        `So I got super into ${topicLower} recently and here's what I found out.`,
        `Everyone's talking about ${topicLower} but nobody's being real about it.`,
        `${topicTitle} is one of those things you don't appreciate until you really look into it.`,
      ],
      ctas: [
        `Drop a 🔥 if you're into ${topicLower} too!`,
        `What's your take on ${topicLower}? Tell me in the comments!`,
        `Save this if ${topicLower} is your thing!`,
        `Share this with someone who loves ${topicLower}!`,
      ],
      tips: [
        `Don't sleep on ${topicLower} — it's more interesting than you think`,
        `Start exploring ${topicLower} with an open mind`,
        `The best way to learn about ${topicLower} is to just dive in`,
        `Find your community around ${topicLower} — they're everywhere`,
        `Take your time getting into ${topicLower}, there's no rush`,
      ],
      insights: [
        `${topicTitle} is way more nuanced than most people think`,
        `There's a whole world of ${topicLower} content out there`,
        `The ${topicLower} community is super welcoming to newcomers`,
        `Once you get into ${topicLower}, you'll wonder why you waited`,
      ],
    },
    Witty: {
      openers: [
        `${topicTitle}: The unofficial guide nobody asked for (but everyone needs)`,
        `Plot twist: ${topicLower} is actually fascinating`,
        `My relationship status: committed to ${topicLower}`,
        `${topicTitle} walked so the rest of us could run`,
      ],
      hooks: [
        `I didn't choose the ${topicLower} life. The ${topicLower} life chose me.`,
        `If ${topicLower} was a person, I'd probably buy them coffee.`,
        `Scientists say thinking about ${topicLower} activates the same brain regions as chocolate. Okay I made that up, but it should be true.`,
        `${topicTitle}: because apparently we need another thing to have opinions about. And I have MANY.`,
      ],
      ctas: [
        `Follow for more unsolicited ${topicLower} opinions 😎`,
        `If this ${topicLower} post made you smirk, hit that like button!`,
        `Tag someone who needs a ${topicLower} reality check!`,
        `Save this — you'll need this ${topicLower} wisdom later, trust me.`,
      ],
      tips: [
        `Approach ${topicLower} like you approach a buffet — try everything`,
        `The secret to ${topicLower}? Confidence and a WiFi connection`,
        `Don't take ${topicLower} too seriously — but also, take it seriously`,
        `Master ${topicLower} and you'll be the most interesting person at parties`,
        `Step 1: Get into ${topicLower}. Step 2: Make it your personality`,
      ],
      insights: [
        `${topicTitle} is basically a whole personality trait at this point`,
        `We don't deserve ${topicLower} but we're lucky to have it`,
        `${topicTitle} > literally everything else (fight me)`,
        `The world would be boring without ${topicLower} content, and that's a fact`,
      ],
    },
    Inspirational: {
      openers: [
        `${topicTitle} has the power to change everything`,
        `Your journey with ${topicLower} starts with a single step`,
        `Why ${topicLower} could be the turning point you've been waiting for`,
        `Dream bigger with ${topicLower}`,
      ],
      hooks: [
        `Every expert in ${topicLower} was once a complete beginner. Your time to start is now.`,
        `${topicTitle} isn't just a topic — it's a gateway to transformation.`,
        `The people who succeed with ${topicLower} are the ones who refuse to give up.`,
        `Imagine where you could be a year from now if you committed to ${topicLower} today.`,
      ],
      ctas: [
        `Start your ${topicLower} journey today. Your future self will thank you.`,
        `Share this with someone who needs inspiration about ${topicLower}!`,
        `Double tap if ${topicLower} inspires you to be better!`,
        `What does ${topicLower} mean to YOU? Tell me your story below.`,
      ],
      tips: [
        `Believe in your ability to master ${topicLower}`,
        `Every small step in ${topicLower} is progress worth celebrating`,
        `Surround yourself with people passionate about ${topicLower}`,
        `Let ${topicLower} fuel your creativity and drive`,
        `Stay consistent with ${topicLower} — results will follow`,
      ],
      insights: [
        `${topicTitle} can be the catalyst for incredible personal growth`,
        `The most inspiring stories often start with ${topicLower}`,
        `${topicTitle} reminds us that passion drives everything`,
        `Your unique perspective on ${topicLower} is what makes you stand out`,
      ],
    },
    Educational: {
      openers: [
        `Everything you need to know about ${topicLower}`,
        `${topicTitle} 101: A comprehensive breakdown`,
        `Let's learn about ${topicLower} — here are the key facts`,
        `The ultimate guide to understanding ${topicLower}`,
      ],
      hooks: [
        `Most people misunderstand ${topicLower}. Here's what the research actually shows.`,
        `I've spent weeks studying ${topicLower} and distilled it into this breakdown.`,
        `${topicTitle} is more complex than it seems on the surface. Let me explain.`,
        `Did you know these facts about ${topicLower}? Most people don't.`,
      ],
      ctas: [
        `Save this ${topicLower} guide for reference!`,
        `Share with someone who wants to learn about ${topicLower}!`,
        `What aspect of ${topicLower} do you want me to cover next?`,
        `Follow for more educational content about ${topicLower} and related topics.`,
      ],
      tips: [
        `Start with the fundamentals of ${topicLower} before going deep`,
        `Cross-reference multiple sources when studying ${topicLower}`,
        `Practice applying your ${topicLower} knowledge in real scenarios`,
        `Join communities focused on ${topicLower} for peer learning`,
        `Keep a journal of your ${topicLower} learnings and insights`,
      ],
      insights: [
        `Understanding ${topicLower} requires both theory and practical experience`,
        `The ${topicLower} field is constantly evolving with new developments`,
        `Critical thinking is essential when evaluating ${topicLower} information`,
        `${topicTitle} connects to many other important areas of knowledge`,
      ],
    },
    Controversial: {
      openers: [
        `Unpopular opinion about ${topicLower} (hear me out)`,
        `${topicTitle}: the take nobody wants to hear`,
        `I'm going to say what everyone's thinking about ${topicLower}`,
        `Hot take: Most people are wrong about ${topicLower}`,
      ],
      hooks: [
        `Here's the uncomfortable truth about ${topicLower} that nobody talks about.`,
        `I know this ${topicLower} take will ruffle some feathers, but someone had to say it.`,
        `${topicTitle} has a problem, and pretending it doesn't exist won't fix it.`,
        `90% of what you've been told about ${topicLower} is outdated or flat-out wrong.`,
      ],
      ctas: [
        `Agree or disagree on ${topicLower}? Let's debate in the comments!`,
        `Share this if you're not afraid to challenge the ${topicLower} status quo!`,
        `Bookmark this ${topicLower} hot take — you'll want to come back to it.`,
        `What's YOUR controversial take on ${topicLower}? Drop it below 👇`,
      ],
      tips: [
        `Question everything you've been told about ${topicLower}`,
        `Don't follow the crowd when it comes to ${topicLower} — think for yourself`,
        `Challenge conventional wisdom about ${topicLower} with evidence`,
        `The best insights about ${topicLower} come from independent thinking`,
        `Be willing to have the tough conversations about ${topicLower}`,
      ],
      insights: [
        `The mainstream narrative about ${topicLower} is missing key nuances`,
        `Most ${topicLower} "experts" are just echoing each other's opinions`,
        `${topicTitle} deserves a more honest and critical conversation`,
        `The real ${topicLower} story is far more interesting than the popular version`,
      ],
    },
  };

  return styles[tone] || styles.Casual;
}

function generateInstagram(topicTitle: string, topicLower: string, style: ToneStyle, words: string[]): string {
  const opener = pickRandom(style.openers);
  const hook = pickRandom(style.hooks);
  const tips = shuffleAndPick(style.tips, 3);
  const cta = pickRandom(style.ctas);

  return `${opener}\n\n${hook}\n\nHere's what I've learned about ${topicLower}:\n\n` +
    `1️⃣ ${tips[0]}\n2️⃣ ${tips[1]}\n3️⃣ ${tips[2]}\n\n${cta}`;
}

function generateTwitter(topicTitle: string, topicLower: string, style: ToneStyle, words: string[]): string {
  const variant = Math.random();
  if (variant < 0.5) {
    // Thread-style
    const hook = pickRandom(style.hooks);
    const insight = pickRandom(style.insights);
    const tips = shuffleAndPick(style.tips, 3);
    const cta = pickRandom(style.ctas);
    return `${pickRandom(style.openers)}\n\n${hook}\n\n→ ${tips[0]}\n→ ${tips[1]}\n→ ${tips[2]}\n\n${insight}\n\n${cta}`;
  } else {
    // Punchy single tweet
    const hook = pickRandom(style.hooks);
    const insight = pickRandom(style.insights);
    const cta = pickRandom(style.ctas);
    return `${hook}\n\n${insight}\n\n${cta}`;
  }
}

function generateFacebook(topicTitle: string, topicLower: string, style: ToneStyle, words: string[]): string {
  const opener = pickRandom(style.openers);
  const hook = pickRandom(style.hooks);
  const tips = shuffleAndPick(style.tips, 4);
  const insight = pickRandom(style.insights);
  const cta = pickRandom(style.ctas);

  return `${opener}\n\n${hook}\n\n${insight}\n\nKey takeaways about ${topicLower}:\n\n` +
    `✅ ${tips[0]}\n✅ ${tips[1]}\n✅ ${tips[2]}\n✅ ${tips[3]}\n\n${cta}`;
}

function generateLinkedin(topicTitle: string, topicLower: string, style: ToneStyle, words: string[]): string {
  const opener = pickRandom(style.openers);
  const hook = pickRandom(style.hooks);
  const insights = shuffleAndPick(style.insights, 2);
  const tips = shuffleAndPick(style.tips, 3);
  const cta = pickRandom(style.ctas);

  return `${opener}\n\n${hook}\n\n${insights[0]}\n\n` +
    `Here are 3 key perspectives on ${topicLower}:\n\n` +
    `• ${tips[0]}\n• ${tips[1]}\n• ${tips[2]}\n\n` +
    `${insights[1]}\n\n${cta}\n\n#${words[0] || "Insights"} #${words[1] || "Trends"} #${topicTitle.replace(/\s+/g, "")}`;
}

function generateTikTok(topicTitle: string, topicLower: string, style: ToneStyle, words: string[]): string {
  const hook = pickRandom(style.hooks);
  const tips = shuffleAndPick(style.tips, 3);
  const cta = pickRandom(style.ctas);

  return `POV: You finally understand ${topicLower} 🎯\n\n${hook}\n\n` +
    `Here's the quick breakdown:\n\n` +
    `🔥 ${tips[0]}\n💡 ${tips[1]}\n⚡ ${tips[2]}\n\n${cta}`;
}

function generateSmartHashtags(topic: string, platform: string): string[] {
  const words = topic.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const topicTag = topic.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).map(w => capitalize(w)).join("");

  // Topic-specific hashtags
  const topicHashtags = words.slice(0, 3).map(w => capitalize(w));

  // Combined phrase hashtag
  const combined = words.length >= 2 ? [capitalize(words[0]) + capitalize(words[1])] : [];

  // Platform-specific trending tags
  const platformTags: Record<string, string[]> = {
    instagram: ["InstaDaily", "ExplorePage", "Trending", "Viral", "ContentCreator"],
    twitter: ["Trending", "MustRead", "Thread", "HotTake"],
    facebook: ["Community", "ShareThis", "Discussion", "Trending"],
    linkedin: ["ProfessionalDevelopment", "Industry", "Leadership", "Innovation"],
    tiktok: ["FYP", "ForYou", "Viral", "LearnOnTikTok", "DidYouKnow"],
  };

  const pTags = shuffleAndPick(platformTags[platform] || platformTags.instagram, 2);

  return [...topicHashtags, ...combined, topicTag, ...pTags].filter((v, i, a) => a.indexOf(v) === i).slice(0, 8);
}
