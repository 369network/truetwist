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
    // Simulate AI generation (in production, call your AI API)
    await new Promise(r => setTimeout(r, 2000));
    const posts = platforms.map(platform => ({
      id: Math.random().toString(36).slice(2),
      platform,
      content: generateMockContent(topic, tone, platform),
      hashtags: generateHashtags(topic),
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

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">AI Content Generator</h1>
      <p className="text-sm mb-8" style={{ color: "var(--tt-text-muted)" }}>Describe your topic and let AI create scroll-stopping content for you.</p>

      {/* Input */}
      <div className="p-6 rounded-2xl mb-6" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        <label className="block text-sm font-medium mb-2">What do you want to post about?</label>
        <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., Launch of our new AI product, tips for growing on Instagram, behind the scenes of our startup..." rows={3} className="input-field resize-none mb-4" />

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

        <button onClick={handleGenerate} disabled={generating || !topic.trim()} className="px-6 py-3 rounded-xl text-white font-semibold transition hover:-translate-y-0.5 disabled:opacity-50" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          {generating ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Generating...
            </span>
          ) : "✨ Generate Content"}
        </button>
      </div>

      {/* Results */}
      {generated.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Generated Content</h2>
          {generated.map(post => (
            <div key={post.id} className="p-5 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full text-xs font-medium capitalize" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                  {post.platform === "twitter" ? "X (Twitter)" : post.platform}
                </span>
                <button onClick={() => savePost(post)} disabled={saving === post.id} className="px-4 py-1.5 rounded-lg text-xs font-medium transition" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                  {saving === post.id ? "Saving..." : "💾 Save as Draft"}
                </button>
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

function generateMockContent(topic: string, tone: string, platform: string): string {
  const templates: Record<string, string[]> = {
    instagram: [
      `${topic}\n\nThis is what nobody tells you about growth. The secret? Consistency + AI.\n\nWe built TrueTwist to help you 10x your content game. Here's the truth:\n\n1. Quality > Quantity (but why not both?)\n2. AI doesn't replace creativity — it amplifies it\n3. The best time to post was yesterday. The second best? Right now.\n\nSave this for later. You'll need it. 👆`,
      `Stop scrolling. Read this.\n\n${topic}\n\nMost people spend 3+ hours creating content. We spend 30 seconds.\n\nThe difference? AI-powered content generation that actually understands your brand voice.\n\nDouble tap if you're tired of the content grind. ❤️`,
    ],
    twitter: [
      `${topic}\n\nHot take: You don't need more followers.\n\nYou need better content.\n\nThat's exactly why we built TrueTwist — AI that creates viral-worthy posts in seconds.\n\nThe future of content creation is here. 🧵`,
      `${topic}\n\n3 things I learned about social media:\n\n→ AI saves 10+ hours/week\n→ Consistency beats perfection\n→ Data-driven > gut feeling\n\nThe game has changed. Are you keeping up?`,
    ],
    facebook: [
      `📢 ${topic}\n\nExciting news! We've been working on something incredible.\n\nImagine creating a week's worth of social media content in minutes. That's not a dream — that's TrueTwist.\n\nOur AI understands trends, your audience, and your brand. The result? Content that connects.\n\nWhat would you do with 10 extra hours every week? Drop your answer below! 👇`,
    ],
    linkedin: [
      `${topic}\n\nI've spent the last 3 years studying what makes content go viral.\n\nHere's what I found:\n\nIt's not luck. It's not timing. It's not even creativity.\n\nIt's understanding your audience at a deeper level than anyone else.\n\nThat's why we built TrueTwist — an AI platform that analyzes engagement patterns and creates content that resonates.\n\nThe results speak for themselves:\n• 45% increase in engagement\n• 10x faster content creation\n• Consistent posting across all platforms\n\nWhat's your biggest content challenge? Let me know in the comments.`,
    ],
    tiktok: [
      `POV: You just discovered AI can create your social media content 🤯\n\n${topic}\n\nNo more staring at a blank screen.\nNo more copying what everyone else does.\nNo more inconsistent posting.\n\nJust pure, viral-worthy content generated in seconds.\n\nFollow for more creator hacks! 🔥`,
    ],
  };
  const options = templates[platform] || templates.instagram;
  return options[Math.floor(Math.random() * options.length)];
}

function generateHashtags(topic: string): string[] {
  const words = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  return [...words, "TrueTwist", "AIContent", "SocialMedia", "ContentCreator", "ViralContent", "GrowthHacking"].slice(0, 8);
}
