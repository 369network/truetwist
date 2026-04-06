"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase";

const tones = ["Professional", "Casual", "Fun & Playful", "Inspirational", "Edgy & Bold", "Educational"];
const platformList = ["instagram", "twitter", "facebook", "linkedin", "tiktok"];
const contentTypes = [
  { id: "post", label: "Post", icon: "📝" },
  { id: "story", label: "Story / Reel", icon: "🎬" },
  { id: "carousel", label: "Carousel / Slides", icon: "🖼️" },
  { id: "video", label: "Video Script", icon: "🎥" },
];

/* TRUA-7: 9 Content Category Templates */
const contentCategories = [
  { id: "educational", label: "Educational / Tips", desc: "5 things you didn't know about..." },
  { id: "behind_scenes", label: "Behind the Scenes", desc: "Show your process and team" },
  { id: "customer_spotlight", label: "Customer Spotlight", desc: "Testimonials and success stories" },
  { id: "product_showcase", label: "Product Showcase", desc: "Feature highlights with benefits" },
  { id: "industry_news", label: "Industry News", desc: "Commentary on trends" },
  { id: "engagement", label: "Engagement", desc: "Questions, polls, debates" },
  { id: "promotional", label: "Promotional", desc: "Sales, launches, offers" },
  { id: "storytelling", label: "Storytelling", desc: "Personal narrative + lesson" },
  { id: "meme_humor", label: "Meme / Humor", desc: "Relatable industry humor" },
];

const platformIcons: Record<string, string> = {
  instagram: "📸", twitter: "𝕏", facebook: "👥", linkedin: "💼", tiktok: "🎵",
};

const platformColors: Record<string, string> = {
  instagram: "#E4405F", twitter: "#1DA1F2", facebook: "#1877F2", linkedin: "#0A66C2", tiktok: "#000000",
};

export default function GeneratePage() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Casual");
  const [contentType, setContentType] = useState("post");
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "twitter"]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<any[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState("");
  const [mediaPreview, setMediaPreview] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("preview");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const addMediaUrl = () => {
    const url = mediaInput.trim();
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      setMediaUrls(prev => [...prev, url]);
      setMediaPreview(prev => [...prev, url]);
      setMediaInput("");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setMediaPreview(prev => [...prev, dataUrl]);
        setMediaUrls(prev => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeMedia = (index: number) => {
    setMediaUrls(prev => prev.filter((_, i) => i !== index));
    setMediaPreview(prev => prev.filter((_, i) => i !== index));
  };

  const [aiError, setAiError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setAiError(null);

    try {
      // Call real AI API
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          tone,
          platforms,
          contentType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate content");
      }

      const posts = data.posts.map((post: any) => ({
        ...post,
        mediaUrls: [...mediaUrls],
      }));
      setGenerated(posts);
    } catch (err: any) {
      console.error("AI generation error:", err);
      setAiError(err.message || "AI generation failed");
      // Fallback to client-side generation
      const posts = platforms.map(platform => ({
        id: Math.random().toString(36).slice(2),
        platform,
        content: generateContent(topic.trim(), tone, platform, contentType),
        hashtags: generateSmartHashtags(topic.trim(), platform),
        mediaUrls: [...mediaUrls],
        contentType,
      }));
      setGenerated(posts);
    } finally {
      setGenerating(false);
    }
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
      media_urls: post.mediaUrls.length > 0 ? post.mediaUrls : null,
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

  const [contentCategory, setContentCategory] = useState("educational");

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Content Studio</h1>
      <p className="text-sm mb-8" style={{ color: "var(--tt-text-muted)" }}>Create scroll-stopping posts, stories, reels, and video scripts with AI.</p>

      {/* Content Category Selector (TRUA-7) */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-3" style={{ fontFamily: "var(--font-heading)" }}>Content Category</label>
        <div className="flex flex-wrap gap-2">
          {contentCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setContentCategory(cat.id)}
              className="px-3 py-2 rounded-lg text-xs font-medium transition"
              style={{
                background: contentCategory === cat.id ? "rgba(99,102,241,0.2)" : "var(--tt-surface)",
                color: contentCategory === cat.id ? "#a5b4fc" : "var(--tt-text-muted)",
                border: `1px solid ${contentCategory === cat.id ? "rgba(99,102,241,0.4)" : "var(--tt-border)"}`,
              }}
              title={cat.desc}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--tt-text-muted)" }}>
          {contentCategories.find(c => c.id === contentCategory)?.desc}
        </p>
      </div>

      {/* Input Section */}
      <div className="p-6 rounded-2xl mb-6" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        <label className="block text-sm font-medium mb-2">What do you want to post about?</label>
        <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., car vs bike comparison, fitness tips for beginners, product launch, travel photography..." rows={3} className="input-field resize-none mb-4" />

        {/* Content Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Content Type</label>
          <div className="flex flex-wrap gap-2">
            {contentTypes.map(ct => (
              <button key={ct.id} onClick={() => setContentType(ct.id)} className="px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5" style={{
                background: contentType === ct.id ? "rgba(99,102,241,0.2)" : "var(--tt-surface-2)",
                color: contentType === ct.id ? "#a5b4fc" : "var(--tt-text-muted)",
                border: contentType === ct.id ? "1px solid rgba(99,102,241,0.4)" : "1px solid var(--tt-border)",
              }}>
                <span>{ct.icon}</span> {ct.label}
              </button>
            ))}
          </div>
        </div>

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

        {/* Media Upload Section */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Attach Media (optional)</label>
          <div className="flex gap-2 mb-2">
            <input value={mediaInput} onChange={e => setMediaInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addMediaUrl()} placeholder="Paste image or video URL..." className="input-field flex-1 text-sm" />
            <button onClick={addMediaUrl} className="px-4 py-2 rounded-lg text-xs font-medium shrink-0" style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.4)" }}>+ Add URL</button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-lg text-xs font-medium shrink-0" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>📁 Upload</button>
          </div>
          {mediaPreview.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {mediaPreview.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt={`Media ${i + 1}`} className="w-20 h-20 object-cover rounded-lg" style={{ border: "1px solid var(--tt-border)" }} onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' fill='%23666'%3E%3Crect width='80' height='80' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='10'%3E🎬 Video%3C/text%3E%3C/svg%3E"; }} />
                  <button onClick={() => removeMedia(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition" style={{ background: "#ef4444", color: "white" }}>×</button>
                </div>
              ))}
            </div>
          )}
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

      {/* AI Error Banner */}
      {aiError && (
        <div className="p-4 rounded-xl mb-4 flex items-start gap-3" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <span className="text-lg">⚠️</span>
          <div>
            <p className="text-sm font-medium" style={{ color: "#f59e0b" }}>AI API unavailable — using smart fallback</p>
            <p className="text-xs mt-1" style={{ color: "var(--tt-text-muted)" }}>{aiError}. Content was generated using built-in templates. Add your OpenAI API key in Vercel settings for real AI-powered generation.</p>
          </div>
        </div>
      )}

      {/* Results with Social Preview */}
      {generated.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Generated Content for &ldquo;{topic}&rdquo;</h2>
            <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "var(--tt-surface-2)" }}>
              <button onClick={() => setActiveTab("preview")} className="px-3 py-1 rounded text-xs font-medium transition" style={{ background: activeTab === "preview" ? "rgba(99,102,241,0.3)" : "transparent", color: activeTab === "preview" ? "#a5b4fc" : "var(--tt-text-muted)" }}>Preview</button>
              <button onClick={() => setActiveTab("raw")} className="px-3 py-1 rounded text-xs font-medium transition" style={{ background: activeTab === "raw" ? "rgba(99,102,241,0.3)" : "transparent", color: activeTab === "raw" ? "#a5b4fc" : "var(--tt-text-muted)" }}>Raw Text</button>
            </div>
          </div>

          {generated.map(post => (
            <div key={post.id}>
              {activeTab === "preview" ? (
                <SocialPreviewCard post={post} onSave={savePost} onCopy={copyToClipboard} saving={saving} />
              ) : (
                <div className="p-5 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 rounded-full text-xs font-medium capitalize" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                      {post.platform === "twitter" ? "X (Twitter)" : post.platform}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => copyToClipboard(post.content + "\n\n" + post.hashtags.map((h: string) => "#" + h).join(" "))} className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>📋 Copy</button>
                      <button onClick={() => savePost(post)} disabled={saving === post.id} className="px-4 py-1.5 rounded-lg text-xs font-medium transition" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>{saving === post.id ? "Saving..." : "💾 Save"}</button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {post.hashtags.map((h: string, i: number) => (
                      <span key={i} className="text-xs" style={{ color: "#818cf8" }}>#{h}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Social Media Preview Card — renders posts like real social platforms
// ============================================================

function SocialPreviewCard({ post, onSave, onCopy, saving }: { post: any; onSave: (p: any) => void; onCopy: (t: string) => void; saving: string | null }) {
  const pColor = platformColors[post.platform] || "#6366f1";
  const pIcon = platformIcons[post.platform] || "📱";
  const pName = post.platform === "twitter" ? "X (Twitter)" : post.platform;
  const hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
  const isVideo = post.contentType === "video" || post.contentType === "story";
  const isCarousel = post.contentType === "carousel";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
      {/* Platform Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--tt-border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ background: `${pColor}22`, border: `2px solid ${pColor}` }}>
            {pIcon}
          </div>
          <div>
            <div className="text-sm font-semibold capitalize">{pName}</div>
            <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
              {post.contentType === "story" ? "Story / Reel" : post.contentType === "carousel" ? "Carousel Post" : post.contentType === "video" ? "Video" : "Post"}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onCopy(post.content + "\n\n" + post.hashtags.map((h: string) => "#" + h).join(" "))} className="px-3 py-1.5 rounded-lg text-xs font-medium transition hover:scale-105" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>📋 Copy</button>
          <button onClick={() => onSave(post)} disabled={saving === post.id} className="px-3 py-1.5 rounded-lg text-xs font-medium transition hover:scale-105" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>{saving === post.id ? "Saving..." : "💾 Save"}</button>
        </div>
      </div>

      {/* Media Section */}
      {hasMedia && (
        <div className="relative">
          {isCarousel && post.mediaUrls.length > 1 ? (
            <div className="flex overflow-x-auto snap-x" style={{ scrollSnapType: "x mandatory" }}>
              {post.mediaUrls.map((url: string, i: number) => (
                <div key={i} className="snap-center shrink-0 w-full">
                  <img src={url} alt={`Slide ${i + 1}`} className="w-full h-72 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative">
              <img src={post.mediaUrls[0]} alt="Post media" className="w-full h-72 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                    <span className="text-2xl ml-1">▶</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {isCarousel && post.mediaUrls.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {post.mediaUrls.map((_: string, i: number) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === 0 ? "white" : "rgba(255,255,255,0.4)" }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* No media placeholder */}
      {!hasMedia && (
        <div className="h-48 flex flex-col items-center justify-center" style={{ background: `linear-gradient(135deg, ${pColor}15, ${pColor}05)` }}>
          <span className="text-5xl mb-2">{isVideo ? "🎥" : isCarousel ? "🖼️" : "📱"}</span>
          <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
            {isVideo ? "Video content — add media above" : isCarousel ? "Add images for carousel slides" : "Add an image or video to enhance this post"}
          </span>
        </div>
      )}

      {/* Engagement Bar */}
      <div className="flex items-center gap-5 px-4 py-2.5" style={{ borderBottom: "1px solid var(--tt-border)" }}>
        <span className="text-lg cursor-pointer hover:scale-110 transition">❤️</span>
        <span className="text-lg cursor-pointer hover:scale-110 transition">💬</span>
        <span className="text-lg cursor-pointer hover:scale-110 transition">🔄</span>
        <span className="text-lg cursor-pointer hover:scale-110 transition ml-auto">🔖</span>
      </div>

      {/* Post Content */}
      <div className="px-4 py-3">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {post.hashtags.map((h: string, i: number) => (
            <span key={i} className="text-xs cursor-pointer hover:underline" style={{ color: pColor }}>#{h}</span>
          ))}
        </div>
      </div>

      {/* Viral Score + AI Insights */}
      {post.viralScore && (
        <div className="px-4 py-3" style={{ borderTop: "1px solid var(--tt-border)" }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-medium" style={{ color: "var(--tt-text-muted)" }}>Viral Score</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--tt-surface-2)" }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${post.viralScore}%`,
                background: post.viralScore >= 80 ? "linear-gradient(90deg, #10b981, #34d399)" : post.viralScore >= 60 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #ef4444, #f87171)",
              }} />
            </div>
            <span className="text-sm font-bold" style={{
              color: post.viralScore >= 80 ? "#10b981" : post.viralScore >= 60 ? "#f59e0b" : "#ef4444",
            }}>{post.viralScore}/100</span>
          </div>

          {/* Viral Factors */}
          {post.viralFactors?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {post.viralFactors.map((f: string, i: number) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* Improvements */}
          {post.improvements?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {post.improvements.map((imp: string, i: number) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                  {imp}
                </span>
              ))}
            </div>
          )}

          {/* A/B Variant Hook */}
          {post.alternativeHook && (
            <div className="mt-3 p-3 rounded-xl" style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }}>A/B Variant</span>
                <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Alternative hook for testing</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--tt-text)" }}>{post.alternativeHook}</p>
            </div>
          )}
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

function generateContent(topic: string, tone: string, platform: string, contentType: string = "post"): string {
  const topicTitle = topic.split(/\s+/).map(w => capitalize(w.toLowerCase())).join(" ");
  const topicLower = topic.toLowerCase();

  // Extract key concepts from topic
  const words = topic.split(/\s+/).filter(w => w.length > 2);

  // Generate tone-specific openers, bodies, and closers
  const toneStyles = getToneStyle(tone, topicTitle, topicLower, words);

  // Content-type specific generation
  if (contentType === "video") {
    return generateVideoScript(topicTitle, topicLower, toneStyles, platform, words);
  }
  if (contentType === "story") {
    return generateStoryReel(topicTitle, topicLower, toneStyles, platform, words);
  }
  if (contentType === "carousel") {
    return generateCarousel(topicTitle, topicLower, toneStyles, platform, words);
  }

  // Regular post — platform-specific formatting
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

// ============================================================
// Content Type Generators — Video Script, Story/Reel, Carousel
// ============================================================

function generateVideoScript(topicTitle: string, topicLower: string, style: ToneStyle, platform: string, words: string[]): string {
  const hook = pickRandom(style.hooks);
  const tips = shuffleAndPick(style.tips, 3);
  const insight = pickRandom(style.insights);
  const cta = pickRandom(style.ctas);

  const platformNote = platform === "tiktok" ? "Keep under 60 seconds for max reach" :
    platform === "instagram" ? "Optimal length: 30-90 seconds for Reels" :
    platform === "twitter" ? "Keep under 2:20 for best engagement" :
    platform === "linkedin" ? "2-5 minutes for thought leadership" :
    "1-3 minutes for best engagement";

  return `🎬 VIDEO SCRIPT: ${topicTitle}\n📏 ${platformNote}\n\n` +
    `[HOOK — 0:00-0:03]\n"${hook}"\n\n` +
    `[MAIN CONTENT — 0:03-0:45]\n` +
    `Point 1: ${tips[0]}\n` +
    `Point 2: ${tips[1]}\n` +
    `Point 3: ${tips[2]}\n\n` +
    `[KEY TAKEAWAY — 0:45-0:55]\n"${insight}"\n\n` +
    `[CTA — 0:55-1:00]\n"${cta}"\n\n` +
    `📌 On-screen text suggestions:\n• "${topicTitle}"\n• Key stats or numbers\n• "${cta.slice(0, 50)}"`;
}

function generateStoryReel(topicTitle: string, topicLower: string, style: ToneStyle, platform: string, words: string[]): string {
  const hook = pickRandom(style.hooks);
  const tips = shuffleAndPick(style.tips, 3);
  const cta = pickRandom(style.ctas);
  const insight = pickRandom(style.insights);

  return `📱 STORY / REEL: ${topicTitle}\n\n` +
    `[SLIDE 1 — Hook]\n🔥 "${hook.slice(0, 80)}"\nText overlay on eye-catching background\n\n` +
    `[SLIDE 2 — The Problem]\nMost people struggle with ${topicLower}.\nBut it doesn't have to be that way.\n\n` +
    `[SLIDE 3 — Tip #1]\n💡 ${tips[0]}\n\n` +
    `[SLIDE 4 — Tip #2]\n⚡ ${tips[1]}\n\n` +
    `[SLIDE 5 — Tip #3]\n🎯 ${tips[2]}\n\n` +
    `[SLIDE 6 — Key Insight]\n"${insight}"\n\n` +
    `[SLIDE 7 — CTA]\n${cta}\n\n` +
    `🎵 Suggested audio: Trending audio / motivational beat\n📊 Add poll sticker: "Do you agree? Yes / No"`;
}

function generateCarousel(topicTitle: string, topicLower: string, style: ToneStyle, platform: string, words: string[]): string {
  const opener = pickRandom(style.openers);
  const tips = shuffleAndPick(style.tips, 5);
  const insight = pickRandom(style.insights);
  const cta = pickRandom(style.ctas);

  return `🖼️ CAROUSEL POST: ${topicTitle}\n\n` +
    `📌 Slide 1 (Cover):\n"${opener}"\nBold title with topic image\n\n` +
    `📌 Slide 2:\n"${tips[0]}"\nUse a relevant icon or illustration\n\n` +
    `📌 Slide 3:\n"${tips[1]}"\nInclude a supporting visual or stat\n\n` +
    `📌 Slide 4:\n"${tips[2]}"\nAdd a before/after or comparison\n\n` +
    `📌 Slide 5:\n"${tips[3]}"\nShowcase an example or case study\n\n` +
    `📌 Slide 6:\n"${tips[4]}"\nHighlight a key quote or data point\n\n` +
    `📌 Slide 7 (Summary):\n"${insight}"\n\n` +
    `📌 Slide 8 (CTA):\n"${cta}"\nInclude profile tag and save reminder\n\n` +
    `🎨 Design tips: Use consistent brand colors, 1080×1080px, readable fonts`;
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
