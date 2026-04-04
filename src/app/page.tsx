"use client";

import Link from "next/link";
import { useState } from "react";

/* ─── Feature Cards (TRUA-25) ─── */
const features = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    title: "AI Content Generation",
    desc: "Generate scroll-stopping posts for any platform in seconds using GPT-4, Gemini, and more.",
    color: "#6366f1",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: "Smart Scheduling",
    desc: "Auto-schedule posts at peak engagement times across all your social accounts.",
    color: "#a855f7",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Analytics Dashboard",
    desc: "Track performance, engagement rates, and growth across all platforms in one unified view.",
    color: "#ff6b6b",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
      </svg>
    ),
    title: "Viral Suggestions",
    desc: "AI analyzes trending topics and suggests content ideas that are most likely to go viral.",
    color: "#f59e0b",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    title: "Multi-Platform Sync",
    desc: "Connect Instagram, X, Facebook, LinkedIn, and TikTok — post everywhere at once.",
    color: "#10b981",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.764m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
    title: "Content Templates",
    desc: "Use pre-built templates or create your own for consistent brand messaging across all channels.",
    color: "#8b5cf6",
  },
];

/* ─── How It Works Steps ─── */
const steps = [
  { num: "01", title: "Describe Your Content", desc: "Tell TrueTwist what you want to post — a topic, idea, or just a vibe. Our AI does the rest." },
  { num: "02", title: "AI Creates & Optimizes", desc: "Our AI generates platform-specific content, optimized for engagement with the right tone and hashtags." },
  { num: "03", title: "Review, Schedule & Post", desc: "Edit if you want, schedule for the perfect time, and publish across all platforms with one click." },
];

/* ─── Pricing Tiers (TRUA-8) ─── */
const pricingTiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for getting started",
    features: ["5 AI posts/month", "1 social account", "Basic templates", "Manual posting", "Community support"],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$29",
    period: "/mo",
    desc: "For growing creators",
    features: ["50 AI posts/month", "3 social accounts", "All templates", "Smart scheduling", "Basic analytics", "Email support"],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$79",
    period: "/mo",
    desc: "For serious creators & brands",
    features: ["Unlimited AI posts", "10 social accounts", "Advanced AI models", "Auto-scheduling", "Full analytics suite", "Content calendar", "Priority support", "Custom tones"],
    cta: "Go Pro",
    highlighted: true,
  },
  {
    name: "Business",
    price: "$199",
    period: "/mo",
    desc: "For teams & agencies",
    features: ["Everything in Pro", "Unlimited accounts", "Team collaboration", "Custom AI training", "White-label reports", "API access", "Dedicated manager", "SLA guarantee"],
    cta: "Contact Sales",
    highlighted: false,
  },
];

/* ─── FAQ (TRUA-25) ─── */
const faqs = [
  { q: "What AI models does TrueTwist use?", a: "TrueTwist uses a combination of GPT-4, Gemini, and other cutting-edge AI models to generate content that's optimized for each platform. You can choose your preferred model or let our system pick the best one automatically." },
  { q: "Can I try TrueTwist for free?", a: "Yes! Our Free plan gives you 5 AI-generated posts per month and 1 connected social account. No credit card required to get started." },
  { q: "Which social platforms are supported?", a: "TrueTwist supports Instagram (feed, Stories, Reels), X (Twitter), Facebook (pages & groups), LinkedIn (personal & company), and TikTok. We're continuously adding more platforms." },
  { q: "How does auto-scheduling work?", a: "Our AI analyzes your audience's engagement patterns and automatically schedules posts at the optimal times for maximum reach. Available on Starter plans and above." },
  { q: "Can I edit AI-generated content before posting?", a: "Absolutely! Every piece of generated content is fully editable. Think of AI as your first draft — you always have final say before anything goes live." },
  { q: "Is my data secure?", a: "Yes. We use industry-standard encryption, never sell your data, and comply with GDPR and CCPA. Your content and analytics data belong to you." },
  { q: "Can I cancel my subscription anytime?", a: "Yes, you can cancel or downgrade your plan at any time. There are no long-term contracts or cancellation fees." },
  { q: "Do you offer team collaboration?", a: "Team features are available on our Business plan. Multiple team members can collaborate, review content, and manage approvals before posting." },
];

/* ─── Social Proof Stats ─── */
const stats = [
  { value: "50K+", label: "Posts Generated" },
  { value: "12K+", label: "Active Creators" },
  { value: "4.9/5", label: "User Rating" },
  { value: "98%", label: "Time Saved" },
];

/* ─── Testimonials ─── */
const testimonials = [
  { name: "Sarah Chen", role: "Content Creator", text: "TrueTwist cut my content creation time by 80%. I went from spending 4 hours a day to 30 minutes.", avatar: "SC" },
  { name: "Marcus Johnson", role: "Marketing Director", text: "The AI-generated content actually sounds human. Our engagement rates doubled within the first month.", avatar: "MJ" },
  { name: "Priya Sharma", role: "Startup Founder", text: "Finally, a tool that understands each platform is different. The cross-platform optimization is incredible.", avatar: "PS" },
];

/* ─── FAQ Accordion Component ─── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border-b transition-colors"
      style={{ borderColor: "var(--tt-border)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="font-semibold text-base pr-4" style={{ fontFamily: "var(--font-heading)" }}>{q}</span>
        <span
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-transform"
          style={{
            background: "var(--tt-surface-2)",
            color: "var(--tt-primary-light)",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          +
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "200px" : "0px", opacity: open ? 1 : 0 }}
      >
        <p className="pb-5 text-sm leading-relaxed" style={{ color: "var(--tt-text-muted)" }}>{a}</p>
      </div>
    </div>
  );
}

/* ─── Platform Icons ─── */
const platformIcons = [
  { name: "Instagram", color: "#E4405F" },
  { name: "X (Twitter)", color: "#ffffff" },
  { name: "Facebook", color: "#1877F2" },
  { name: "LinkedIn", color: "#0A66C2" },
  { name: "TikTok", color: "#ff0050" },
];

/* ─── Main Page ─── */
export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: "var(--tt-bg)" }}>
      {/* ─── Navbar ─── */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4 glass sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
          >
            T
          </div>
          <span className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            True<span style={{ color: "var(--tt-accent)" }}>Twist</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: "var(--tt-text-muted)" }}>
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#how-it-works" className="hover:text-white transition">How It Works</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
          <a href="#faq" className="hover:text-white transition">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm font-medium hover:text-white transition"
            style={{ color: "var(--tt-text-muted)" }}
          >
            Log in
          </Link>
          <Link href="/auth/signup" className="btn-primary text-sm px-5 py-2.5">
            Start Free
          </Link>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative px-6 md:px-12 pt-24 pb-32 text-center max-w-6xl mx-auto gradient-hero overflow-hidden">
        {/* Glow Orbs */}
        <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full animate-glow-orb" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)" }} />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 rounded-full animate-glow-orb" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.15), transparent 70%)", animationDelay: "2s" }} />
        <div className="absolute top-40 right-1/3 w-48 h-48 rounded-full animate-glow-orb" style={{ background: "radial-gradient(circle, rgba(255,107,107,0.12), transparent 70%)", animationDelay: "1s" }} />

        <div className="relative z-10">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-8"
            style={{
              background: "rgba(99,102,241,0.12)",
              color: "#a5b4fc",
              border: "1px solid rgba(99,102,241,0.25)",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Powered by GPT-4 & Advanced AI Models
          </div>

          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-6"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Create <span className="gradient-text">Viral Content</span>
            <br />
            in Seconds, Not Hours
          </h1>

          <p
            className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: "var(--tt-text-muted)" }}
          >
            TrueTwist uses AI to generate, schedule, and post platform-optimized social media content that actually engages your audience. Stop guessing, start growing.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link href="/auth/signup" className="btn-primary px-8 py-4 text-lg">
              Get Started Free
            </Link>
            <Link
              href="#how-it-works"
              className="px-8 py-4 rounded-xl font-semibold text-lg transition hover:-translate-y-1"
              style={{ border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}
            >
              See How It Works
            </Link>
          </div>

          <p className="text-xs mb-8" style={{ color: "var(--tt-text-muted)" }}>
            No credit card required. Free plan available.
          </p>

          {/* Platform Badges */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {platformIcons.map((p) => (
              <span
                key={p.name}
                className="text-xs font-medium px-4 py-2 rounded-full transition hover:-translate-y-0.5"
                style={{
                  background: "var(--tt-surface)",
                  border: "1px solid var(--tt-border)",
                  color: p.color,
                }}
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Dashboard Preview Mockup ─── */}
      <section className="px-6 md:px-12 -mt-12 pb-24 max-w-6xl mx-auto relative z-10">
        <div
          className="rounded-2xl overflow-hidden glow"
          style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
        >
          <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--tt-border)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: "#ef4444" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#f59e0b" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#10b981" }} />
            <span className="ml-3 text-xs" style={{ color: "var(--tt-text-muted)" }}>
              TrueTwist Dashboard
            </span>
          </div>
          <div className="p-6 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Posts Scheduled", value: "47", change: "+23%", color: "#6366f1" },
              { label: "Engagement Rate", value: "8.4%", change: "+45%", color: "#a855f7" },
              { label: "Follower Growth", value: "+834", change: "+12%", color: "#ff6b6b" },
              { label: "AI Credits", value: "2,340", change: "Remaining", color: "#10b981" },
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
                <div className="text-xs mb-2" style={{ color: "var(--tt-text-muted)" }}>
                  {stat.label}
                </div>
                <div className="text-2xl md:text-3xl font-bold" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="text-xs mt-1" style={{ color: "#10b981" }}>
                  {stat.change}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Social Proof Stats ─── */}
      <section className="px-6 md:px-12 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((s, i) => (
            <div key={i}>
              <div className="text-3xl md:text-4xl font-extrabold gradient-text" style={{ fontFamily: "var(--font-heading)" }}>
                {s.value}
              </div>
              <div className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="features" className="px-6 md:px-12 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4"
            style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc" }}
          >
            Features
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
            Everything You Need to{" "}
            <span className="gradient-text">Go Viral</span>
          </h2>
          <p className="max-w-xl mx-auto" style={{ color: "var(--tt-text-muted)" }}>
            Powerful AI tools to create, schedule, and analyze your social media content across every platform.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="card p-7 group">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                style={{ background: `${f.color}15`, color: f.color }}
              >
                {f.icon}
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--tt-text-muted)" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="px-6 md:px-12 py-24 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4"
            style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc" }}
          >
            How It Works
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
            Three Steps to <span className="gradient-text">Viral Content</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={i} className="relative text-center">
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center text-2xl font-extrabold"
                style={{
                  background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))",
                  color: "var(--tt-primary-light)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {s.num}
              </div>
              {i < steps.length - 1 && (
                <div
                  className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px"
                  style={{ background: "linear-gradient(90deg, var(--tt-border), transparent)" }}
                />
              )}
              <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--tt-text-muted)" }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="px-6 md:px-12 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4"
            style={{ background: "rgba(255,107,107,0.12)", color: "#fca5a5" }}
          >
            Testimonials
          </div>
          <h2 className="text-3xl md:text-5xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            Loved by <span className="gradient-text">Creators</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="card p-7">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
                    {t.role}
                  </div>
                </div>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--tt-text-muted)" }}>
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex gap-1 mt-4">
                {[...Array(5)].map((_, j) => (
                  <span key={j} style={{ color: "#f59e0b" }}>&#9733;</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="px-6 md:px-12 py-24 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4"
            style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7" }}
          >
            Pricing
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
            Simple, <span className="gradient-text">Transparent</span> Pricing
          </h2>
          <p style={{ color: "var(--tt-text-muted)" }}>
            Start free, upgrade as you grow. Cancel anytime.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pricingTiers.map((p, i) => (
            <div
              key={i}
              className={`relative p-7 rounded-2xl transition-all hover:-translate-y-1 ${p.highlighted ? "animate-pulse-glow" : ""}`}
              style={{
                background: "var(--tt-surface)",
                border: p.highlighted ? "2px solid #6366f1" : "1px solid var(--tt-border)",
              }}
            >
              {p.highlighted && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                {p.name}
              </h3>
              <p className="text-xs mt-1 mb-4" style={{ color: "var(--tt-text-muted)" }}>
                {p.desc}
              </p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>
                  {p.price}
                </span>
                <span className="text-sm" style={{ color: "var(--tt-text-muted)" }}>
                  {p.period}
                </span>
              </div>
              <ul className="space-y-3 mb-8">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5" style={{ color: "#10b981" }}>&#10003;</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className={`block text-center py-3 rounded-xl font-semibold text-sm transition hover:-translate-y-0.5 ${p.highlighted ? "btn-primary" : ""}`}
                style={
                  p.highlighted
                    ? {}
                    : {
                        background: "var(--tt-surface-2)",
                        color: "white",
                        border: "1px solid var(--tt-border)",
                      }
                }
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Enterprise CTA */}
        <div
          className="mt-12 p-8 rounded-2xl text-center"
          style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
        >
          <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
            Enterprise
          </h3>
          <p className="text-sm mb-4" style={{ color: "var(--tt-text-muted)" }}>
            Custom solutions for large teams and agencies. Unlimited everything, dedicated support, custom integrations.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block px-8 py-3 rounded-xl font-semibold text-sm transition hover:-translate-y-0.5"
            style={{
              border: "1px solid var(--tt-primary)",
              color: "var(--tt-primary-light)",
            }}
          >
            Contact Sales
          </Link>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="px-6 md:px-12 py-24 max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4"
            style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}
          >
            FAQ
          </div>
          <h2 className="text-3xl md:text-5xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            Got <span className="gradient-text">Questions?</span>
          </h2>
        </div>
        <div>
          {faqs.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="px-6 md:px-12 py-24 max-w-4xl mx-auto text-center">
        <div
          className="p-12 md:p-16 rounded-3xl relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15), rgba(255,107,107,0.1))",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
            Ready to <span className="gradient-text">Transform</span> Your Social Media?
          </h2>
          <p className="mb-8" style={{ color: "var(--tt-text-muted)" }}>
            Join thousands of creators who are already growing faster with TrueTwist AI.
          </p>
          <Link href="/auth/signup" className="btn-primary px-10 py-4 text-lg inline-block">
            Start Creating for Free
          </Link>
          <p className="text-xs mt-4" style={{ color: "var(--tt-text-muted)" }}>
            No credit card required
          </p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer
        className="px-6 md:px-12 py-16"
        style={{ borderTop: "1px solid var(--tt-border)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
                >
                  T
                </div>
                <span className="font-bold text-lg" style={{ fontFamily: "var(--font-heading)" }}>
                  True<span style={{ color: "var(--tt-accent)" }}>Twist</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--tt-text-muted)" }}>
                AI-Powered Social Media Content Creation Platform. Create, schedule, and grow.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-semibold text-sm mb-4" style={{ fontFamily: "var(--font-heading)" }}>Product</h4>
              <ul className="space-y-2 text-sm" style={{ color: "var(--tt-text-muted)" }}>
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#faq" className="hover:text-white transition">FAQ</a></li>
                <li><Link href="/auth/signup" className="hover:text-white transition">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4" style={{ fontFamily: "var(--font-heading)" }}>Platforms</h4>
              <ul className="space-y-2 text-sm" style={{ color: "var(--tt-text-muted)" }}>
                <li><span className="hover:text-white transition cursor-default">Instagram</span></li>
                <li><span className="hover:text-white transition cursor-default">X (Twitter)</span></li>
                <li><span className="hover:text-white transition cursor-default">Facebook</span></li>
                <li><span className="hover:text-white transition cursor-default">LinkedIn</span></li>
                <li><span className="hover:text-white transition cursor-default">TikTok</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4" style={{ fontFamily: "var(--font-heading)" }}>Legal</h4>
              <ul className="space-y-2 text-sm" style={{ color: "var(--tt-text-muted)" }}>
                <li><span className="hover:text-white transition cursor-default">Privacy Policy</span></li>
                <li><span className="hover:text-white transition cursor-default">Terms of Service</span></li>
                <li><span className="hover:text-white transition cursor-default">Cookie Policy</span></li>
              </ul>
            </div>
          </div>

          <div
            className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs"
            style={{ borderTop: "1px solid var(--tt-border)", color: "var(--tt-text-muted)" }}
          >
            <p>&copy; 2026 TrueTwist. All rights reserved.</p>
            <p>
              Built with AI. Made for creators.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
