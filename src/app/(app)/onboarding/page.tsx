"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Building2,
  Globe,
  Users,
  Palette,
  CheckCircle2,
  Zap,
  ExternalLink,
  Rocket,
  Target,
  Lightbulb,
  Calendar,
  Wand2,
  BarChart3,
  ChevronRight,
} from "lucide-react";

/* ──────── Data ──────── */

const industries = [
  "E-Commerce", "SaaS / Tech", "Marketing Agency", "Real Estate",
  "Health & Fitness", "Food & Restaurant", "Fashion & Beauty", "Education",
  "Finance", "Travel & Hospitality", "Entertainment", "Non-Profit",
  "Personal Brand", "Consulting", "Photography", "Art & Design",
  "Music", "Sports", "Automotive", "Legal", "Healthcare", "Other",
];

const brandVoices = [
  { id: "professional", label: "Professional", desc: "Polished, authoritative, trustworthy", color: "border-brand-500 bg-brand-50 dark:bg-brand-900/20" },
  { id: "casual", label: "Casual", desc: "Friendly, approachable, conversational", color: "border-green-500 bg-green-50 dark:bg-green-900/20" },
  { id: "fun", label: "Fun & Playful", desc: "Energetic, humorous, lighthearted", color: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" },
  { id: "inspirational", label: "Inspirational", desc: "Motivating, uplifting, empowering", color: "border-violet-500 bg-violet-50 dark:bg-violet-900/20" },
  { id: "edgy", label: "Edgy & Bold", desc: "Direct, provocative, confident", color: "border-coral-500 bg-coral-50 dark:bg-coral-900/20" },
  { id: "educational", label: "Educational", desc: "Informative, clear, helpful", color: "border-blue-500 bg-blue-50 dark:bg-blue-900/20" },
];

const socialPlatforms = [
  { id: "instagram", name: "Instagram", color: "#E4405F" },
  { id: "twitter", name: "Twitter/X", color: "#1DA1F2" },
  { id: "facebook", name: "Facebook", color: "#1877F2" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2" },
  { id: "tiktok", name: "TikTok", color: "#ff0050" },
  { id: "youtube", name: "YouTube", color: "#FF0000" },
  { id: "pinterest", name: "Pinterest", color: "#BD081C" },
  { id: "threads", name: "Threads", color: "#000000" },
];

const contentTypes = [
  { id: "images", label: "Images", desc: "Photos & graphics" },
  { id: "carousels", label: "Carousels", desc: "Multi-slide posts" },
  { id: "short_videos", label: "Short Videos", desc: "Reels & TikToks" },
  { id: "stories", label: "Stories", desc: "24hr content" },
  { id: "text_posts", label: "Text Posts", desc: "Tweets & updates" },
  { id: "threads", label: "Threads", desc: "Long-form threads" },
];

const postingFrequencies = [
  { value: 1, label: "1x/week", desc: "Getting started" },
  { value: 3, label: "3x/week", desc: "Consistent" },
  { value: 5, label: "5x/week", desc: "Active" },
  { value: 7, label: "Daily", desc: "Power user" },
  { value: 14, label: "2x/day", desc: "Aggressive growth" },
];

const tourSteps = [
  {
    icon: Wand2,
    title: "Content Studio",
    desc: "Generate AI-powered posts in seconds. Choose your tone, platform, and let AI do the heavy lifting.",
    href: "/content-studio",
    color: "text-brand-500",
    bg: "bg-brand-50 dark:bg-brand-900/20",
  },
  {
    icon: Calendar,
    title: "Calendar",
    desc: "Plan and schedule your content across all platforms. See your full publishing timeline at a glance.",
    href: "/calendar",
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/20",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    desc: "Track engagement, follower growth, and content performance. Get actionable insights to improve.",
    href: "/analytics",
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  {
    icon: Target,
    title: "Viral Trends",
    desc: "Discover trending topics in your niche. Never miss a viral opportunity again.",
    href: "/trends",
    color: "text-coral-500",
    bg: "bg-coral-50 dark:bg-coral-900/20",
  },
];

/* ──────── Steps Config ──────── */

const TOTAL_STEPS = 6;

const stepMeta = [
  { num: 1, label: "Welcome", icon: Sparkles },
  { num: 2, label: "Business", icon: Building2 },
  { num: 3, label: "Platforms", icon: Globe },
  { num: 4, label: "Content", icon: Palette },
  { num: 5, label: "Tour", icon: Lightbulb },
  { num: 6, label: "Launch", icon: Rocket },
];

/* ──────── Component ──────── */

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 2: Business
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [brandVoice, setBrandVoice] = useState("");

  // Step 3: Platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Step 4: Content
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(["images", "text_posts"]);
  const [postingFrequency, setPostingFrequency] = useState(3);

  const progress = (step / TOTAL_STEPS) * 100;

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleContentType = (id: string) => {
    setSelectedContentTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const canProceed = () => {
    switch (step) {
      case 2: return businessName.trim().length > 0 && industry.length > 0;
      case 3: return selectedPlatforms.length > 0;
      case 4: return selectedContentTypes.length > 0;
      default: return true;
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    // In production: save onboarding data via API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    router.push("/");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Progress Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-dark-surface/80 backdrop-blur-sm border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm bg-gradient-to-r from-brand-600 to-purple-600 bg-clip-text text-transparent">
                TrueTwist Setup
              </span>
            </div>
            <span className="text-xs text-gray-400 dark:text-dark-muted">
              Step {step} of {TOTAL_STEPS}
            </span>
          </div>
          <Progress value={progress} />
          {/* Step indicators */}
          <div className="flex items-center justify-between mt-3">
            {stepMeta.map((s) => (
              <button
                key={s.num}
                onClick={() => s.num < step && setStep(s.num)}
                disabled={s.num > step}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  s.num === step
                    ? "text-brand-600 dark:text-brand-400"
                    : s.num < step
                    ? "text-green-500 cursor-pointer"
                    : "text-gray-300 dark:text-dark-border cursor-default"
                }`}
              >
                {s.num < step ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <s.icon className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-2xl">

          {/* ═══════ STEP 1: Welcome ═══════ */}
          {step === 1 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-2xl gradient-brand mx-auto flex items-center justify-center shadow-elevated">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Welcome to TrueTwist</h1>
                <p className="text-gray-500 dark:text-dark-muted mt-2 max-w-md mx-auto">
                  Let&apos;s set up your account in a few quick steps. We&apos;ll personalize your AI content generation and get you posting in minutes.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
                {[
                  { icon: Building2, label: "Set up your brand", time: "1 min" },
                  { icon: Globe, label: "Connect platforms", time: "2 min" },
                  { icon: Sparkles, label: "Start creating", time: "Instant" },
                ].map((item) => (
                  <div key={item.label} className="p-4 rounded-lg bg-gray-50 dark:bg-dark-surface-2 text-center">
                    <item.icon className="w-6 h-6 text-brand-500 mx-auto mb-2" />
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-gray-400 dark:text-dark-muted mt-0.5">{item.time}</p>
                  </div>
                ))}
              </div>
              <Button size="lg" onClick={() => setStep(2)}>
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* ═══════ STEP 2: Business Profile ═══════ */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Tell us about your business</h2>
                <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">
                  This helps us tailor AI-generated content to your brand.
                </p>
              </div>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Business Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Your business name"
                        className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Website</label>
                      <input
                        type="url"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://yourbusiness.com"
                        className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Industry <span className="text-red-400">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {industries.map((ind) => (
                        <button
                          key={ind}
                          onClick={() => setIndustry(ind)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            industry === ind
                              ? "bg-brand-50 dark:bg-brand-900/20 border-brand-500 text-brand-600 dark:text-brand-400"
                              : "border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-muted hover:border-gray-300"
                          }`}
                        >
                          {ind}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Business Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Briefly describe what your business does and who your audience is..."
                      className="w-full h-24 p-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Brand Voice */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Choose your brand voice</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {brandVoices.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setBrandVoice(voice.id)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        brandVoice === voice.id
                          ? voice.color
                          : "border-gray-200 dark:border-dark-border hover:border-gray-300"
                      }`}
                    >
                      <p className="text-sm font-semibold">{voice.label}</p>
                      <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">{voice.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════ STEP 3: Connect Platforms ═══════ */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Connect your social accounts</h2>
                <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">
                  Select the platforms you want to manage. You can connect them now or later in settings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {socialPlatforms.map((platform) => {
                  const isSelected = selectedPlatforms.includes(platform.id);
                  return (
                    <button
                      key={platform.id}
                      onClick={() => togglePlatform(platform.id)}
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/10"
                          : "border-gray-200 dark:border-dark-border hover:border-gray-300"
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ backgroundColor: platform.color }}
                      >
                        {platform.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{platform.name}</p>
                        <p className="text-xs text-gray-400 dark:text-dark-muted">
                          {isSelected ? "Selected" : "Click to select"}
                        </p>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="w-5 h-5 text-brand-500 flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-dark-border flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedPlatforms.length > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-brand-50 dark:bg-brand-900/10 text-sm text-brand-600 dark:text-brand-400">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  {selectedPlatforms.length} platform{selectedPlatforms.length > 1 ? "s" : ""} selected.
                  You&apos;ll connect them via OAuth after setup.
                </div>
              )}
            </div>
          )}

          {/* ═══════ STEP 4: Content Preferences ═══════ */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Content preferences</h2>
                <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">
                  Tell us what type of content you want to create and how often.
                </p>
              </div>

              {/* Content Types */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-sm font-semibold mb-3">What content do you create?</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {contentTypes.map((type) => {
                      const isSelected = selectedContentTypes.includes(type.id);
                      return (
                        <button
                          key={type.id}
                          onClick={() => toggleContentType(type.id)}
                          className={`p-4 rounded-lg border-2 text-center transition-all ${
                            isSelected
                              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                              : "border-gray-200 dark:border-dark-border hover:border-gray-300"
                          }`}
                        >
                          <p className="text-sm font-semibold">{type.label}</p>
                          <p className="text-xs text-gray-400 dark:text-dark-muted mt-0.5">{type.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Posting Frequency */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-sm font-semibold mb-3">How often do you want to post?</h3>
                  <div className="flex flex-wrap gap-3">
                    {postingFrequencies.map((freq) => (
                      <button
                        key={freq.value}
                        onClick={() => setPostingFrequency(freq.value)}
                        className={`px-5 py-3 rounded-lg border-2 text-center transition-all ${
                          postingFrequency === freq.value
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                            : "border-gray-200 dark:border-dark-border hover:border-gray-300"
                        }`}
                      >
                        <p className="text-sm font-bold">{freq.label}</p>
                        <p className="text-xs text-gray-400 dark:text-dark-muted mt-0.5">{freq.desc}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════ STEP 5: Dashboard Tour ═══════ */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Quick tour of your dashboard</h2>
                <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">
                  Here are the key features you&apos;ll use every day.
                </p>
              </div>

              <div className="space-y-4">
                {tourSteps.map((item, i) => (
                  <Card key={i}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                          <item.icon className={`w-6 h-6 ${item.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{item.title}</h3>
                            <Badge variant="secondary" className="text-[10px]">
                              Step {i + 1}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-dark-muted">{item.desc}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 dark:text-dark-border mt-1 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 rounded-md bg-violet-50 dark:bg-violet-900/10 text-sm text-violet-600 dark:text-violet-400">
                <Lightbulb className="w-4 h-4 flex-shrink-0" />
                Pro tip: Start by generating your first post in the Content Studio!
              </div>
            </div>
          )}

          {/* ═══════ STEP 6: Launch ═══════ */}
          {step === 6 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 mx-auto flex items-center justify-center shadow-elevated">
                <Rocket className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">You&apos;re all set!</h1>
                <p className="text-gray-500 dark:text-dark-muted mt-2 max-w-md mx-auto">
                  Your TrueTwist account is ready. Let&apos;s review what you&apos;ve set up.
                </p>
              </div>

              {/* Summary */}
              <Card className="text-left max-w-md mx-auto">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-dark-muted">Business</span>
                    <span className="text-sm font-medium">{businessName || "Not set"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-dark-muted">Industry</span>
                    <span className="text-sm font-medium">{industry || "Not set"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-dark-muted">Brand Voice</span>
                    <span className="text-sm font-medium capitalize">{brandVoice || "Not set"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-dark-muted">Platforms</span>
                    <div className="flex gap-1">
                      {selectedPlatforms.length > 0 ? (
                        selectedPlatforms.map((pid) => {
                          const p = socialPlatforms.find((sp) => sp.id === pid);
                          return (
                            <div
                              key={pid}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold"
                              style={{ backgroundColor: p?.color }}
                              title={p?.name}
                            >
                              {p?.name.charAt(0)}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-sm text-gray-400">None</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-dark-muted">Posting</span>
                    <span className="text-sm font-medium">
                      {postingFrequencies.find((f) => f.value === postingFrequency)?.label || "3x/week"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-dark-muted">Content Types</span>
                    <span className="text-sm font-medium">{selectedContentTypes.length} selected</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col items-center gap-3">
                <Button size="lg" onClick={handleFinish} disabled={saving}>
                  {saving ? (
                    <>Launching...</>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4 mr-2" />
                      Launch My Dashboard
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-400 dark:text-dark-muted">
                  You can change all of these settings later.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          {step > 1 && step < 6 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-dark-border">
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                {step < 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-gray-400"
                    onClick={() => setStep(step + 1)}
                  >
                    Skip
                  </Button>
                )}
                <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                  {step === 5 ? "Finish Setup" : "Continue"}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="flex justify-center mt-6">
              <Button variant="ghost" size="sm" onClick={() => setStep(5)}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Go back
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
