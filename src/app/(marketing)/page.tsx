"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Calendar,
  BarChart3,
  Globe,
  Users,
  Bot,
  ChevronDown,
  Check,
  Star,
  Share2,
  Copy,
  Mail,
  Hash,
  AtSign,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

/* ─── Waitlist Form ───────────────────────────────────────────────── */

function WaitlistForm({ variant = "hero" }: { variant?: "hero" | "bottom" }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [referralLink, setReferralLink] = useState("");
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to join waitlist. Please try again.");
        return;
      }
      setReferralLink(`https://truetwist.com?ref=${data.referralCode}`);
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-6 ${
          variant === "hero"
            ? "bg-white/10 border-white/20 text-white backdrop-blur-sm"
            : "bg-brand-50 dark:bg-brand-950/30 border-brand-200 dark:border-brand-800"
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
          <p className="font-semibold">You&apos;re on the list!</p>
        </div>
        <p className={`text-sm mb-4 ${variant === "hero" ? "text-white/70" : "text-gray-600 dark:text-gray-400"}`}>
          Share your unique link to move up the waitlist:
        </p>
        <div className={`flex items-center gap-2 rounded-lg p-2 ${
          variant === "hero" ? "bg-white/10" : "bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border"
        }`}>
          <code className="text-xs flex-1 truncate">{referralLink}</code>
          <button
            onClick={() => navigator.clipboard?.writeText(referralLink)}
            className="p-1.5 rounded-md hover:bg-white/20 transition-colors flex-shrink-0"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <span className={`text-xs ${variant === "hero" ? "text-white/50" : "text-gray-400"}`}>Share:</span>
          <button className="p-1.5 rounded-full hover:bg-white/10 transition-colors" aria-label="Share on Twitter">
            <Hash className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded-full hover:bg-white/10 transition-colors" aria-label="Share on LinkedIn">
            <ExternalLink className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded-full hover:bg-white/10 transition-colors" aria-label="Share via email">
            <Mail className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div
        className={`flex items-center rounded-full border overflow-hidden ${
          variant === "hero"
            ? "bg-white/10 border-white/20 backdrop-blur-sm"
            : "bg-white dark:bg-dark-surface border-gray-200 dark:border-dark-border shadow-card"
        }`}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className={`flex-1 px-5 py-3.5 bg-transparent text-sm outline-none min-w-0 ${
            variant === "hero"
              ? "text-white placeholder:text-white/50"
              : "text-gray-900 dark:text-white placeholder:text-gray-400"
          }`}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3.5 bg-coral-500 hover:bg-coral-600 text-white text-sm font-semibold rounded-full m-1 transition-colors whitespace-nowrap disabled:opacity-50"
        >
          {loading ? "Joining..." : "Join Waitlist"}
        </button>
      </div>
      {error && <p className="text-coral-400 text-xs mt-2 ml-4">{error}</p>}
    </form>
  );
}

/* ─── Section Wrapper ─────────────────────────────────────────────── */

function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`px-4 sm:px-6 lg:px-8 ${className}`}
    >
      <div className="max-w-6xl mx-auto">{children}</div>
    </section>
  );
}

/* ─── FAQ Item ────────────────────────────────────────────────────── */

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 dark:border-dark-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="font-medium text-gray-900 dark:text-white pr-4">{q}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-gray-600 dark:text-dark-muted text-sm leading-relaxed">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Data ────────────────────────────────────────────────────────── */

const features = [
  {
    icon: Bot,
    title: "AI Content Generation",
    desc: "Generate scroll-stopping posts, threads, and captions tailored to each platform with one click.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    desc: "AI analyzes your audience to find the perfect posting times. Set it and let TrueTwist handle the rest.",
  },
  {
    icon: Globe,
    title: "7+ Platform Support",
    desc: "Instagram, Twitter/X, LinkedIn, TikTok, Facebook, YouTube, Pinterest — all from one dashboard.",
  },
  {
    icon: Zap,
    title: "Viral Trend Detection",
    desc: "Real-time trend monitoring spots opportunities before they peak so you can ride every wave.",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    desc: "Track engagement, follower growth, and ROI across all platforms with unified, actionable dashboards.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    desc: "Approval workflows, role-based access, and shared content calendars for teams of any size.",
  },
];

const pricingTiers = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    desc: "For individuals getting started",
    highlight: false,
    features: [
      "3 social accounts",
      "30 scheduled posts/mo",
      "Basic AI generation",
      "7-day analytics",
      "Email support",
    ],
  },
  {
    name: "Creator",
    price: "$19",
    period: "/mo",
    desc: "For creators & small businesses",
    highlight: false,
    features: [
      "10 social accounts",
      "200 scheduled posts/mo",
      "Advanced AI + tone control",
      "30-day analytics",
      "Trend detection",
      "Priority support",
    ],
  },
  {
    name: "Pro",
    price: "$49",
    period: "/mo",
    desc: "For growing brands & agencies",
    highlight: true,
    features: [
      "25 social accounts",
      "Unlimited scheduled posts",
      "Premium AI + brand voice",
      "90-day analytics + reports",
      "Team collaboration (5 seats)",
      "API access",
      "Dedicated account manager",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For large teams & organizations",
    highlight: false,
    features: [
      "Unlimited social accounts",
      "Unlimited everything",
      "Custom AI model training",
      "365-day analytics + exports",
      "Unlimited team seats",
      "SSO & advanced security",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
];

const faqs = [
  {
    q: "What social platforms does TrueTwist support?",
    a: "TrueTwist supports Instagram, Twitter/X, LinkedIn, TikTok, Facebook, YouTube, and Pinterest. We're constantly adding more platforms based on user demand.",
  },
  {
    q: "How does the AI content generation work?",
    a: "Our AI analyzes your brand voice, audience preferences, and trending topics to generate platform-optimized content. You can fine-tune tone, style, and length, then edit or approve before publishing.",
  },
  {
    q: "Can I schedule posts across multiple platforms at once?",
    a: "Yes! Create a post once and TrueTwist automatically adapts it for each platform — adjusting character limits, hashtags, image dimensions, and formatting so each version feels native.",
  },
  {
    q: "Is there a free plan?",
    a: "Absolutely. Our Starter plan is free forever and includes 3 social accounts, 30 scheduled posts per month, and basic AI generation. No credit card required.",
  },
  {
    q: "How does the viral trend detection work?",
    a: "TrueTwist monitors trending topics, hashtags, and content patterns in real-time across all supported platforms. When we detect a relevant trend for your niche, you get an alert with AI-generated content suggestions to capitalize on it.",
  },
  {
    q: "Can my team collaborate on content?",
    a: "Pro and Enterprise plans include team collaboration features: shared content calendars, approval workflows, role-based permissions, and comment threads on scheduled posts.",
  },
  {
    q: "What kind of analytics do you provide?",
    a: "Unified analytics across all platforms including engagement rates, follower growth, best posting times, content performance breakdowns, audience demographics, and ROI tracking for paid campaigns.",
  },
  {
    q: "Is my data secure?",
    a: "We use bank-level encryption for all data in transit and at rest. OAuth tokens are encrypted with AES-256. We never store your social media passwords and comply with GDPR, CCPA, and SOC 2.",
  },
  {
    q: "Can I import my existing content calendar?",
    a: "Yes. TrueTwist supports CSV import and integrates with popular tools like Notion, Google Sheets, and Airtable. Our onboarding wizard helps you migrate in minutes.",
  },
  {
    q: "What happens when I reach my plan limits?",
    a: "We'll notify you when you're approaching your limits. You can upgrade anytime, and your existing scheduled content remains untouched. Downgrading pauses future posts beyond the lower plan's limits.",
  },
];

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Social Media Manager, TechStart",
    text: "TrueTwist cut our content creation time by 70%. The AI actually understands our brand voice.",
    avatar: "SC",
  },
  {
    name: "Marcus Williams",
    role: "Founder, CreatorHub",
    text: "The trend detection feature alone is worth it. We caught a viral moment that got us 50K new followers.",
    avatar: "MW",
  },
  {
    name: "Priya Patel",
    role: "CMO, ScaleUp Agency",
    text: "Managing 40+ client accounts from one dashboard with AI-powered content? Game changer.",
    avatar: "PP",
  },
];

/* ─── Navigation ──────────────────────────────────────────────────── */

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-dark-bg/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-dark-border/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 dark:text-white">
            True<span className="text-brand-500">Twist</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-gray-600 dark:text-dark-muted hover:text-brand-500 transition-colors">
            Features
          </a>
          <a href="#pricing" className="text-sm text-gray-600 dark:text-dark-muted hover:text-brand-500 transition-colors">
            Pricing
          </a>
          <a href="#faq" className="text-sm text-gray-600 dark:text-dark-muted hover:text-brand-500 transition-colors">
            FAQ
          </a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 dark:text-dark-muted hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Log in
          </Link>
          <a
            href="#waitlist"
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-full transition-colors"
          >
            Join Waitlist
          </a>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-gray-600 dark:text-dark-muted"
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border"
          >
            <div className="px-4 py-4 space-y-3">
              <a href="#features" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600 dark:text-dark-muted py-2">Features</a>
              <a href="#pricing" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600 dark:text-dark-muted py-2">Pricing</a>
              <a href="#faq" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600 dark:text-dark-muted py-2">FAQ</a>
              <hr className="border-gray-200 dark:border-dark-border" />
              <Link href="/dashboard" className="block text-sm text-gray-600 dark:text-dark-muted py-2">Log in</Link>
              <a href="#waitlist" onClick={() => setMobileOpen(false)} className="block w-full text-center px-4 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-full">
                Join Waitlist
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/* ─── Main Landing Page ───────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950 via-brand-900 to-purple-900" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-400 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-coral-500 rounded-full blur-[120px] animate-pulse [animation-delay:1s]" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-500 rounded-full blur-[100px] animate-pulse [animation-delay:2s]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-sm mb-8 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-coral-400" />
              <span>AI-Powered Social Media Management</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white leading-tight mb-6 tracking-tight">
              Content that stops{" "}
              <br />
              the scroll.{" "}
              <span className="bg-gradient-to-r from-coral-400 to-coral-500 bg-clip-text text-transparent">
                Automatically.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
              Generate, schedule, and publish scroll-stopping content across 7+ platforms.
              Powered by AI that understands what makes content go viral.
            </p>

            <div id="waitlist" className="flex justify-center mb-8">
              <WaitlistForm variant="hero" />
            </div>

            <p className="text-white/40 text-sm">
              Join 12,400+ creators on the waitlist — no credit card required
            </p>
          </motion.div>

          {/* Product preview mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 relative"
          >
            <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-dark-surface mx-auto max-w-4xl">
              {/* Mock browser chrome */}
              <div className="h-10 bg-dark-surface-2 flex items-center px-4 gap-2 border-b border-dark-border">
                <div className="w-3 h-3 rounded-full bg-coral-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <div className="flex-1 mx-8">
                  <div className="h-5 bg-dark-surface-3 rounded-full max-w-xs mx-auto" />
                </div>
              </div>
              {/* Mock dashboard content */}
              <div className="p-6 space-y-4">
                <div className="flex gap-4">
                  {/* Sidebar mock */}
                  <div className="hidden sm:block w-48 space-y-3">
                    <div className="h-8 bg-brand-500/20 rounded-md" />
                    <div className="h-6 bg-dark-surface-3 rounded-md w-3/4" />
                    <div className="h-6 bg-dark-surface-3 rounded-md w-2/3" />
                    <div className="h-6 bg-dark-surface-3 rounded-md w-4/5" />
                    <div className="h-6 bg-dark-surface-3 rounded-md w-1/2" />
                  </div>
                  {/* Main content mock */}
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-20 bg-dark-surface-3 rounded-lg p-3">
                          <div className="h-3 bg-dark-border rounded w-2/3 mb-2" />
                          <div className="h-5 bg-brand-500/30 rounded w-1/2" />
                        </div>
                      ))}
                    </div>
                    <div className="h-40 bg-dark-surface-3 rounded-lg p-4">
                      <div className="h-3 bg-dark-border rounded w-1/4 mb-4" />
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                          <div key={i} className="flex-1">
                            <div
                              className="bg-brand-500/40 rounded-sm"
                              style={{ height: `${30 + Math.random() * 70}%`, minHeight: 20 }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-brand-500/20 via-purple-500/20 to-coral-500/20 blur-3xl -z-10 rounded-3xl" />
          </motion.div>
        </div>
      </section>

      {/* ── Trust badges ── */}
      <Section className="py-12 border-b border-gray-100 dark:border-dark-border">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-50">
          {["ProductHunt", "TechCrunch", "Forbes", "Wired", "TheVerge"].map((name) => (
            <span key={name} className="text-sm font-semibold tracking-wider uppercase text-gray-400 dark:text-dark-muted">
              {name}
            </span>
          ))}
        </div>
      </Section>

      {/* ── Features ── */}
      <Section id="features" className="py-20 md:py-32">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 text-xs font-semibold uppercase tracking-wide mb-4">
            Features
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-brand-500 to-purple-500 bg-clip-text text-transparent">
              dominate social
            </span>
          </h2>
          <p className="text-gray-600 dark:text-dark-muted max-w-xl mx-auto">
            One platform. Every tool. From AI content creation to deep analytics, TrueTwist has it all.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="group p-6 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-elevated transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center mb-4 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 transition-colors">
                <f.icon className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600 dark:text-dark-muted leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── Product Demo Section ── */}
      <Section className="py-20 md:py-32 bg-gray-50 dark:bg-dark-surface">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-coral-50 dark:bg-coral-950/30 text-coral-600 dark:text-coral-400 text-xs font-semibold uppercase tracking-wide mb-4">
              How it works
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight">
              From idea to viral post in{" "}
              <span className="text-coral-500">60 seconds</span>
            </h2>
            <div className="space-y-6">
              {[
                { step: "1", title: "Describe your idea", desc: "Tell the AI what you want to say — or let it suggest trending topics in your niche." },
                { step: "2", title: "AI generates & optimizes", desc: "Get platform-specific variations with optimized hashtags, formatting, and timing." },
                { step: "3", title: "Review & schedule", desc: "Edit, approve, and schedule across all your platforms with a single click." },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{item.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-dark-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Demo mockup */}
          <div className="relative">
            <div className="rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 p-6 shadow-elevated">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium">TrueTwist AI</span>
                <span className="text-xs text-green-500 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-full">Generating</span>
              </div>
              <div className="space-y-3 mb-4">
                <div className="bg-gray-50 dark:bg-dark-surface-3 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AtSign className="w-4 h-4 text-pink-500" />
                    <span className="text-xs font-medium">Instagram</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-dark-text">
                    Stop scrolling. Start creating. Our AI just built this post in 3 seconds flat.
                  </p>
                  <p className="text-xs text-brand-500 mt-1">#AIContent #SocialMedia #ContentCreator</p>
                </div>
                <div className="bg-gray-50 dark:bg-dark-surface-3 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4 text-sky-500" />
                    <span className="text-xs font-medium">Twitter/X</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-dark-text">
                    What if your social media content created itself? That&apos;s not the future — it&apos;s TrueTwist.
                  </p>
                </div>
              </div>
              <button className="w-full py-2.5 rounded-lg gradient-brand text-white text-sm font-medium flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4" />
                Schedule All
              </button>
            </div>
            <div className="absolute -inset-4 bg-gradient-to-r from-brand-500/10 to-coral-500/10 blur-2xl -z-10 rounded-3xl" />
          </div>
        </div>
      </Section>

      {/* ── Social Proof ── */}
      <Section className="py-20 md:py-32">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 text-xs font-semibold uppercase tracking-wide mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Loved by creators worldwide
          </h2>
          <div className="flex items-center justify-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            ))}
          </div>
          <p className="text-sm text-gray-500 dark:text-dark-muted">4.9/5 from 2,000+ beta users</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="p-6 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface"
            >
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-gray-700 dark:text-dark-text mb-6 leading-relaxed">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center text-white font-semibold text-sm">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-muted">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 p-8 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-100 dark:border-dark-border">
          {[
            { value: "12,400+", label: "Waitlist signups" },
            { value: "2M+", label: "Posts generated" },
            { value: "98%", label: "User satisfaction" },
            { value: "4.9/5", label: "Average rating" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-brand-500">{stat.value}</p>
              <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Pricing ── */}
      <Section id="pricing" className="py-20 md:py-32 bg-gray-50 dark:bg-dark-surface">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 text-xs font-semibold uppercase tracking-wide mb-4">
            Pricing
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="text-gray-600 dark:text-dark-muted max-w-xl mx-auto">
            Start free. Scale as you grow. No hidden fees, no surprises.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pricingTiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              viewport={{ once: true }}
              className={`relative rounded-xl p-6 border ${
                tier.highlight
                  ? "border-brand-500 bg-white dark:bg-dark-surface-2 shadow-elevated ring-2 ring-brand-500/20"
                  : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2"
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full gradient-brand text-white text-xs font-semibold">
                    Most Popular
                  </span>
                </div>
              )}
              <h3 className="font-semibold text-lg mb-1">{tier.name}</h3>
              <p className="text-xs text-gray-500 dark:text-dark-muted mb-4">{tier.desc}</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">{tier.price}</span>
                <span className="text-gray-500 dark:text-dark-muted text-sm">{tier.period}</span>
              </div>
              <ul className="space-y-3 mb-6">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-dark-text">{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#waitlist"
                className={`block w-full py-2.5 rounded-lg text-sm font-medium text-center transition-colors ${
                  tier.highlight
                    ? "gradient-brand text-white hover:opacity-90"
                    : "bg-gray-100 dark:bg-dark-surface-3 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-dark-border"
                }`}
              >
                {tier.price === "Custom" ? "Contact Sales" : "Join Waitlist"}
              </a>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── FAQ ── */}
      <Section id="faq" className="py-20 md:py-32">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 text-xs font-semibold uppercase tracking-wide mb-4">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
        </div>

        <div className="max-w-2xl mx-auto">
          {faqs.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </Section>

      {/* ── Bottom CTA ── */}
      <Section className="py-20 md:py-32">
        <div className="text-center rounded-2xl gradient-brand p-12 md:p-20 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-white rounded-full blur-[80px]" />
            <div className="absolute bottom-1/4 right-1/3 w-48 h-48 bg-coral-400 rounded-full blur-[60px]" />
          </div>
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Ready to go viral?
            </h2>
            <p className="text-white/70 max-w-lg mx-auto mb-8">
              Join 12,400+ creators and brands already on the waitlist. Be first to experience AI-powered social media management.
            </p>
            <div className="flex justify-center">
              <WaitlistForm variant="hero" />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 dark:border-dark-border py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-md gradient-brand flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-gray-900 dark:text-white">
                  True<span className="text-brand-500">Twist</span>
                </span>
              </Link>
              <p className="text-sm text-gray-500 dark:text-dark-muted leading-relaxed">
                AI-powered social media management for creators and brands.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4">Product</h4>
              <ul className="space-y-2">
                {[
                  { label: "Features", href: "#features" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "FAQ", href: "#faq" },
                  { label: "Waitlist", href: "#waitlist" },
                ].map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="text-sm text-gray-500 dark:text-dark-muted hover:text-brand-500 transition-colors">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4">Company</h4>
              <ul className="space-y-2">
                {[
                  { label: "About", href: "/about" },
                  { label: "Blog", href: "/blog" },
                  { label: "Careers", href: "/careers" },
                  { label: "Contact", href: "mailto:hello@truetwist.com" },
                ].map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="text-sm text-gray-500 dark:text-dark-muted hover:text-brand-500 transition-colors">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4">Legal</h4>
              <ul className="space-y-2">
                {[
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Cookie Policy", href: "/cookies" },
                  { label: "GDPR", href: "/gdpr" },
                ].map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="text-sm text-gray-500 dark:text-dark-muted hover:text-brand-500 transition-colors">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-gray-200 dark:border-dark-border gap-4">
            <p className="text-sm text-gray-400 dark:text-dark-muted">
              &copy; {new Date().getFullYear()} TrueTwist. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://x.com/truetwist" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-500 transition-colors" aria-label="Twitter">
                <Hash className="w-5 h-5" />
              </a>
              <a href="https://linkedin.com/company/truetwist" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-500 transition-colors" aria-label="LinkedIn">
                <Globe className="w-5 h-5" />
              </a>
              <a href="https://instagram.com/truetwist" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-500 transition-colors" aria-label="Instagram">
                <AtSign className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
