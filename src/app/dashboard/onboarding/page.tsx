"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

/* ─── TRUA-6: 6-Step Onboarding Flow ─── */

const industries = [
  "E-commerce", "SaaS / Tech", "Marketing Agency", "Real Estate", "Health & Fitness",
  "Food & Restaurant", "Fashion & Beauty", "Education", "Finance", "Travel & Hospitality",
  "Entertainment", "Non-Profit", "Personal Brand", "Consulting", "Photography",
  "Art & Design", "Music", "Sports", "Automotive", "Legal", "Healthcare", "Other",
];

const brandVoices = [
  { id: "professional", label: "Professional", desc: "Polished, authoritative, trustworthy", icon: "briefcase", color: "#6366f1" },
  { id: "casual", label: "Casual", desc: "Friendly, approachable, conversational", icon: "chat", color: "#10b981" },
  { id: "fun", label: "Fun & Playful", desc: "Energetic, humorous, lighthearted", icon: "party", color: "#f59e0b" },
  { id: "inspirational", label: "Inspirational", desc: "Motivating, uplifting, empowering", icon: "star", color: "#a855f7" },
  { id: "edgy", label: "Edgy & Bold", desc: "Direct, provocative, confident", icon: "fire", color: "#ff6b6b" },
  { id: "educational", label: "Educational", desc: "Informative, clear, helpful", icon: "book", color: "#0ea5e9" },
];

const contentTypes = [
  { id: "images", label: "Images", icon: "image" },
  { id: "carousels", label: "Carousels", icon: "slides" },
  { id: "short_videos", label: "Short Videos", icon: "video" },
  { id: "stories", label: "Stories", icon: "story" },
  { id: "text_posts", label: "Text Posts", icon: "text" },
  { id: "threads", label: "Threads", icon: "thread" },
];

const socialPlatforms = [
  { id: "instagram", name: "Instagram", color: "#E4405F" },
  { id: "twitter", name: "X (Twitter)", color: "#1DA1F2" },
  { id: "facebook", name: "Facebook", color: "#1877F2" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2" },
  { id: "tiktok", name: "TikTok", color: "#ff0050" },
  { id: "youtube", name: "YouTube", color: "#FF0000" },
  { id: "pinterest", name: "Pinterest", color: "#BD081C" },
];

const samplePosts = [
  { platform: "Instagram", type: "Educational", content: "5 things most businesses get wrong about social media in 2026 👇\n\n1. Posting without a strategy\n2. Ignoring analytics completely\n3. Same content on every platform\n4. Not engaging with comments\n5. Missing trending opportunities\n\nWhich one hits home? Drop a number below 👇\n\n#SocialMediaTips #ContentStrategy #BusinessGrowth" },
  { platform: "X (Twitter)", type: "Engagement", content: "Hot take: Most social media advice is outdated by the time it reaches you.\n\nThe real competitive advantage? AI-powered content that adapts in real-time.\n\nAgree or disagree? 🔥" },
  { platform: "LinkedIn", type: "Storytelling", content: "I almost gave up on content marketing last year.\n\n3 months of posting. Zero engagement. Zero leads.\n\nThen I changed one thing: I stopped creating content for algorithms and started creating it for people.\n\nThe result? 10x engagement in 30 days.\n\nHere's what I learned..." },
  { platform: "TikTok", type: "Behind-the-Scenes", content: "POV: You discover AI can create a month of content in 10 minutes 🤯\n\n#ContentCreator #AITools #SocialMediaHacks #MarketingTips" },
  { platform: "Facebook", type: "Customer Spotlight", content: "From struggling to post once a week to publishing daily across 5 platforms — here's how Sarah transformed her business with AI content. 🚀\n\n\"I went from spending 4 hours a day on social media to 30 minutes. My engagement doubled.\"\n\nReady for your transformation? Link in comments 👇" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Step 2: Business Profile
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [brandVoice, setBrandVoice] = useState("");

  // Step 3: Competitors
  const [competitors, setCompetitors] = useState(["", "", ""]);

  // Step 4: Social Accounts
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  // Step 5: Content Preferences
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(["images", "text_posts"]);
  const [postingFrequency, setPostingFrequency] = useState(3);

  const totalSteps = 6;
  const progress = (step / totalSteps) * 100;

  const toggleContentType = (id: string) => {
    setSelectedContentTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const togglePlatform = (id: string) => {
    setConnectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const [finishError, setFinishError] = useState("");

  const handleFinish = async () => {
    setSaving(true);
    setFinishError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: businessName,
        onboarding_completed: true,
      });
      if (error) {
        setFinishError("Failed to save your profile. Please try again.");
        setSaving(false);
        return;
      }
      router.push("/dashboard");
    } catch (e) {
      setFinishError("Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--tt-bg)" }}>
      {/* Progress Bar */}
      <div className="w-full h-1" style={{ background: "var(--tt-surface-2)" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: "linear-gradient(90deg, #6366f1, #a855f7)" }}
        />
      </div>

      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>T</div>
          <span className="font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            True<span style={{ color: "var(--tt-accent)" }}>Twist</span>
          </span>
        </div>
        <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Step {step} of {totalSteps}</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-2xl">

          {/* ─── Step 1: Welcome ─── */}
          {step === 1 && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center animate-pulse-glow" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold mb-3" style={{ fontFamily: "var(--font-heading)" }}>
                Welcome to <span className="gradient-text">TrueTwist</span>
              </h1>
              <p className="text-lg mb-2" style={{ color: "var(--tt-text-muted)" }}>
                Let&apos;s set up your AI content engine in under 10 minutes.
              </p>
              <p className="text-sm mb-8" style={{ color: "var(--tt-text-muted)" }}>
                We&apos;ll collect some info about your business to personalize your content.
              </p>
              <button onClick={() => setStep(2)} className="btn-primary px-10 py-4 text-lg">
                Let&apos;s Go
              </button>
            </div>
          )}

          {/* ─── Step 2: Business Profile ─── */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Tell us about your business</h2>
              <p className="text-sm mb-8" style={{ color: "var(--tt-text-muted)" }}>This helps our AI create on-brand content for you.</p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2">Business Name *</label>
                  <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Your business name" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Website URL</label>
                  <input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://yourbusiness.com" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Industry / Niche *</label>
                  <div className="flex flex-wrap gap-2">
                    {industries.map(ind => (
                      <button
                        key={ind}
                        onClick={() => setIndustry(ind)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                        style={{
                          background: industry === ind ? "rgba(99,102,241,0.2)" : "var(--tt-surface)",
                          color: industry === ind ? "#a5b4fc" : "var(--tt-text-muted)",
                          border: `1px solid ${industry === ind ? "rgba(99,102,241,0.4)" : "var(--tt-border)"}`,
                        }}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Business Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Briefly describe what your business does and who you serve..."
                    rows={3}
                    className="input-field resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-3">Brand Voice *</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {brandVoices.map(v => (
                      <button
                        key={v.id}
                        onClick={() => setBrandVoice(v.id)}
                        className="p-4 rounded-xl text-left transition-all"
                        style={{
                          background: brandVoice === v.id ? `${v.color}15` : "var(--tt-surface)",
                          border: brandVoice === v.id ? `2px solid ${v.color}` : "1px solid var(--tt-border)",
                        }}
                      >
                        <div className="text-sm font-semibold mb-1" style={{ color: brandVoice === v.id ? v.color : "var(--tt-text)" }}>{v.label}</div>
                        <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{v.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button onClick={() => setStep(1)} className="px-6 py-2.5 rounded-xl text-sm" style={{ color: "var(--tt-text-muted)" }}>Back</button>
                <button onClick={() => setStep(3)} disabled={!businessName || !industry || !brandVoice} className="btn-primary px-8 py-2.5 text-sm disabled:opacity-50">Continue</button>
              </div>
            </div>
          )}

          {/* ─── Step 3: Competitor Intelligence ─── */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Add your competitors</h2>
              <p className="text-sm mb-8" style={{ color: "var(--tt-text-muted)" }}>We&apos;ll analyze their strategy to help you outperform them. (Optional)</p>

              <div className="space-y-3">
                {competitors.map((comp, i) => (
                  <div key={i}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--tt-text-muted)" }}>Competitor {i + 1}</label>
                    <input
                      type="text"
                      value={comp}
                      onChange={e => {
                        const updated = [...competitors];
                        updated[i] = e.target.value;
                        setCompetitors(updated);
                      }}
                      placeholder="@handle or website URL"
                      className="input-field"
                    />
                  </div>
                ))}
                {competitors.length < 5 && (
                  <button
                    onClick={() => setCompetitors([...competitors, ""])}
                    className="text-xs font-medium flex items-center gap-1"
                    style={{ color: "#a5b4fc" }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add another
                  </button>
                )}
              </div>

              <div className="mt-6 p-4 rounded-xl" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#818cf8" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "#a5b4fc" }}>AI will analyze</div>
                    <div className="text-xs mt-1" style={{ color: "var(--tt-text-muted)" }}>
                      Posting frequency, top content types, engagement rates, best posting times, and hashtag strategies.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button onClick={() => setStep(2)} className="px-6 py-2.5 rounded-xl text-sm" style={{ color: "var(--tt-text-muted)" }}>Back</button>
                <button onClick={() => setStep(4)} className="btn-primary px-8 py-2.5 text-sm">Continue</button>
              </div>
            </div>
          )}

          {/* ─── Step 4: Connect Social Accounts ─── */}
          {step === 4 && (
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Connect your social accounts</h2>
              <p className="text-sm mb-8" style={{ color: "var(--tt-text-muted)" }}>Select the platforms you want to post to.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {socialPlatforms.map(p => {
                  const connected = connectedPlatforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      className="flex items-center gap-3 p-4 rounded-xl transition-all text-left"
                      style={{
                        background: connected ? `${p.color}12` : "var(--tt-surface)",
                        border: connected ? `2px solid ${p.color}` : "1px solid var(--tt-border)",
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${p.color}15` }}>
                        <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs" style={{ color: connected ? p.color : "var(--tt-text-muted)" }}>
                          {connected ? "Selected" : "Click to select"}
                        </div>
                      </div>
                      {connected && (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={p.color} strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs mt-4" style={{ color: "var(--tt-text-muted)" }}>
                You can connect accounts later in Settings. Select at least 1 to continue.
              </p>

              <div className="flex justify-between mt-8">
                <button onClick={() => setStep(3)} className="px-6 py-2.5 rounded-xl text-sm" style={{ color: "var(--tt-text-muted)" }}>Back</button>
                <button onClick={() => setStep(5)} disabled={connectedPlatforms.length === 0} className="btn-primary px-8 py-2.5 text-sm disabled:opacity-50">Continue</button>
              </div>
            </div>
          )}

          {/* ─── Step 5: Content Preferences ─── */}
          {step === 5 && (
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Set your content preferences</h2>
              <p className="text-sm mb-8" style={{ color: "var(--tt-text-muted)" }}>Tell us what type of content you want to create.</p>

              <div className="mb-8">
                <label className="block text-sm font-medium mb-3">Preferred Content Types</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {contentTypes.map(ct => {
                    const selected = selectedContentTypes.includes(ct.id);
                    return (
                      <button
                        key={ct.id}
                        onClick={() => toggleContentType(ct.id)}
                        className="p-4 rounded-xl text-center transition-all"
                        style={{
                          background: selected ? "rgba(99,102,241,0.15)" : "var(--tt-surface)",
                          border: selected ? "2px solid #6366f1" : "1px solid var(--tt-border)",
                        }}
                      >
                        <div className="text-sm font-medium" style={{ color: selected ? "#a5b4fc" : "var(--tt-text)" }}>{ct.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-sm font-medium mb-3">
                  Posting Frequency: <span style={{ color: "#a5b4fc" }}>{postingFrequency}x per week</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={7}
                  value={postingFrequency}
                  onChange={e => setPostingFrequency(parseInt(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "#6366f1" }}
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: "var(--tt-text-muted)" }}>
                  <span>1x/week</span>
                  <span>Daily</span>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button onClick={() => setStep(4)} className="px-6 py-2.5 rounded-xl text-sm" style={{ color: "var(--tt-text-muted)" }}>Back</button>
                <button onClick={() => setStep(6)} className="btn-primary px-8 py-2.5 text-sm">Continue</button>
              </div>
            </div>
          )}

          {/* ─── Step 6: AI Preview & Launch ─── */}
          {step === 6 && (
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                Your AI content engine is <span className="gradient-text">ready!</span>
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--tt-text-muted)" }}>
                Here&apos;s a preview of AI-generated content for {businessName || "your business"}.
              </p>

              <div className="space-y-4 mb-8">
                {samplePosts.slice(0, 3).map((post, i) => (
                  <div key={i} className="p-5 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>{post.platform}</span>
                      <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{post.type}</span>
                    </div>
                    <p className="text-sm whitespace-pre-line leading-relaxed">{post.content}</p>
                  </div>
                ))}
              </div>

              <div className="p-5 rounded-2xl mb-8 text-center" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))", border: "1px solid rgba(99,102,241,0.2)" }}>
                <h3 className="font-bold mb-1" style={{ fontFamily: "var(--font-heading)" }}>7-Day Free Trial</h3>
                <p className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
                  Full access to all Pro features. No credit card required.
                </p>
              </div>

              {finishError && (
                <div className="p-3 rounded-lg text-sm text-red-400 mb-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>{finishError}</div>
              )}

              <div className="flex justify-between">
                <button onClick={() => setStep(5)} className="px-6 py-2.5 rounded-xl text-sm" style={{ color: "var(--tt-text-muted)" }}>Back</button>
                <button onClick={handleFinish} disabled={saving} className="btn-primary px-10 py-3 text-base disabled:opacity-50">
                  {saving ? "Setting up..." : "Launch My Content Engine"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
