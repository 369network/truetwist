"use client";
import { useState } from "react";
import Link from "next/link";

/* ─── TRUA-29/32: Viral Trends Dashboard ─── */

const trendingTopics = [
  { id: 1, topic: "AI-Generated Art", platform: "instagram", viralScore: 94, velocity: "+340%", category: "Technology", hashtags: ["AIArt", "GenerativeAI", "DigitalArt"], posts: "12.4K" },
  { id: 2, topic: "Remote Work Culture", platform: "linkedin", viralScore: 87, velocity: "+180%", category: "Business", hashtags: ["RemoteWork", "WorkFromHome", "FutureOfWork"], posts: "8.7K" },
  { id: 3, topic: "Sustainable Fashion", platform: "tiktok", viralScore: 82, velocity: "+220%", category: "Lifestyle", hashtags: ["SustainableFashion", "EcoFriendly", "SlowFashion"], posts: "15.2K" },
  { id: 4, topic: "Micro SaaS Startups", platform: "twitter", viralScore: 78, velocity: "+150%", category: "Business", hashtags: ["MicroSaaS", "IndieHacker", "SaaS"], posts: "5.3K" },
  { id: 5, topic: "Plant-Based Cooking", platform: "instagram", viralScore: 75, velocity: "+120%", category: "Food", hashtags: ["PlantBased", "VeganRecipes", "HealthyEating"], posts: "9.1K" },
  { id: 6, topic: "Productivity Hacks 2026", platform: "tiktok", viralScore: 71, velocity: "+95%", category: "Lifestyle", hashtags: ["ProductivityHacks", "LifeHacks", "TimeManagement"], posts: "7.8K" },
  { id: 7, topic: "Web3 Gaming", platform: "twitter", viralScore: 68, velocity: "+88%", category: "Technology", hashtags: ["Web3Gaming", "P2E", "GameFi"], posts: "4.2K" },
  { id: 8, topic: "Mental Health Awareness", platform: "facebook", viralScore: 65, velocity: "+75%", category: "Health", hashtags: ["MentalHealth", "SelfCare", "Wellness"], posts: "11.5K" },
];

const trendingHashtags = [
  { tag: "#AIContent", posts: "2.4M", growth: "+45%" },
  { tag: "#ContentCreator", posts: "18.7M", growth: "+12%" },
  { tag: "#SocialMediaTips", posts: "5.1M", growth: "+28%" },
  { tag: "#MarketingStrategy", posts: "3.8M", growth: "+33%" },
  { tag: "#DigitalMarketing", posts: "12.3M", growth: "+8%" },
  { tag: "#Entrepreneurship", posts: "9.6M", growth: "+15%" },
];

const platformColors: Record<string, { color: string; name: string }> = {
  instagram: { color: "#E4405F", name: "Instagram" },
  twitter: { color: "#1DA1F2", name: "X (Twitter)" },
  linkedin: { color: "#0A66C2", name: "LinkedIn" },
  tiktok: { color: "#ff0050", name: "TikTok" },
  facebook: { color: "#1877F2", name: "Facebook" },
};

function ViralScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "#ff6b6b" : score >= 60 ? "#f59e0b" : "#10b981";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full" style={{ background: "var(--tt-surface-3)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-sm font-bold" style={{ color, minWidth: "28px" }}>{score}</span>
    </div>
  );
}

export default function TrendsPage() {
  const [filter, setFilter] = useState("all");
  const [selectedTrend, setSelectedTrend] = useState<number | null>(null);

  const filtered = filter === "all" ? trendingTopics : trendingTopics.filter(t => t.platform === filter);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Viral Trends</h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>
            Discover trending topics and viral opportunities across platforms.
          </p>
        </div>
      </div>

      {/* Platform Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: "all", label: "All Platforms" },
          { id: "instagram", label: "Instagram" },
          { id: "twitter", label: "X (Twitter)" },
          { id: "linkedin", label: "LinkedIn" },
          { id: "tiktok", label: "TikTok" },
          { id: "facebook", label: "Facebook" },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setFilter(p.id)}
            className="px-4 py-2 rounded-lg text-xs font-medium transition"
            style={{
              background: filter === p.id ? "rgba(99,102,241,0.2)" : "var(--tt-surface)",
              color: filter === p.id ? "#a5b4fc" : "var(--tt-text-muted)",
              border: `1px solid ${filter === p.id ? "rgba(99,102,241,0.4)" : "var(--tt-border)"}`,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trending Topics List */}
        <div className="lg:col-span-2 space-y-3">
          {filtered.map((trend) => {
            const platform = platformColors[trend.platform];
            return (
              <div
                key={trend.id}
                className="p-5 rounded-2xl transition-all hover:-translate-y-0.5 cursor-pointer"
                style={{
                  background: selectedTrend === trend.id ? "var(--tt-surface-2)" : "var(--tt-surface)",
                  border: selectedTrend === trend.id ? "1px solid rgba(99,102,241,0.3)" : "1px solid var(--tt-border)",
                }}
                onClick={() => setSelectedTrend(selectedTrend === trend.id ? null : trend.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${platform.color}15` }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={platform.color} strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold">{trend.topic}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${platform.color}15`, color: platform.color }}>
                          {platform.name}
                        </span>
                        <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{trend.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: "#10b981" }}>{trend.velocity}</div>
                    <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{trend.posts} posts</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-xs mb-1" style={{ color: "var(--tt-text-muted)" }}>Viral Score</div>
                  <ViralScoreBar score={trend.viralScore} />
                </div>

                {/* Expanded content */}
                {selectedTrend === trend.id && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--tt-border)" }}>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {trend.hashtags.map((h, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                          #{h}
                        </span>
                      ))}
                    </div>
                    <Link
                      href={`/dashboard/generate?topic=${encodeURIComponent(trend.topic)}`}
                      className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      Use This Trend
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar — Trending Hashtags */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <h3 className="font-semibold mb-4" style={{ fontFamily: "var(--font-heading)" }}>Trending Hashtags</h3>
            <div className="space-y-3">
              {trendingHashtags.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "#818cf8" }}>{h.tag}</div>
                    <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{h.posts} posts</div>
                  </div>
                  <span className="text-xs font-medium" style={{ color: "#10b981" }}>{h.growth}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trend Alerts */}
          <div className="p-6 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))", border: "1px solid rgba(99,102,241,0.15)" }}>
            <h3 className="font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Trend Alerts</h3>
            <p className="text-xs mb-4" style={{ color: "var(--tt-text-muted)" }}>
              Get notified when trends match your niche.
            </p>
            <button className="btn-primary px-4 py-2 text-sm w-full">
              Enable Alerts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
