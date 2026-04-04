"use client";
import { useState } from "react";

/* ─── TRUA-31/32: Advanced Analytics Dashboard ─── */

const dateRanges = ["7 days", "30 days", "90 days", "12 months"];

const platformData = [
  { name: "Instagram", followers: "2,412", engagement: "4.8%", posts: 23, reach: "12.4K", color: "#E4405F", growth: "+12%" },
  { name: "X (Twitter)", followers: "1,847", engagement: "3.2%", posts: 45, reach: "8.9K", color: "#1DA1F2", growth: "+8%" },
  { name: "LinkedIn", followers: "956", engagement: "5.1%", posts: 12, reach: "4.2K", color: "#0A66C2", growth: "+15%" },
  { name: "TikTok", followers: "5,234", engagement: "7.3%", posts: 18, reach: "34.7K", color: "#ff0050", growth: "+34%" },
  { name: "Facebook", followers: "1,108", engagement: "2.8%", posts: 15, reach: "3.8K", color: "#1877F2", growth: "+5%" },
];

const weeklyData = [
  { day: "Mon", posts: 3, engagement: 245, reach: 1200 },
  { day: "Tue", posts: 5, engagement: 412, reach: 2100 },
  { day: "Wed", posts: 2, engagement: 189, reach: 980 },
  { day: "Thu", posts: 7, engagement: 567, reach: 3400 },
  { day: "Fri", posts: 4, engagement: 323, reach: 1800 },
  { day: "Sat", posts: 6, engagement: 478, reach: 2800 },
  { day: "Sun", posts: 3, engagement: 289, reach: 1500 },
];

const topPosts = [
  { content: "5 AI tools that will change how you create content...", platform: "Instagram", engagement: "1.2K", reach: "8.4K", type: "Carousel" },
  { content: "Hot take: Most social media advice is outdated...", platform: "X (Twitter)", engagement: "847", reach: "12.1K", type: "Thread" },
  { content: "How I grew 10K followers in 30 days using AI...", platform: "TikTok", engagement: "2.3K", reach: "45.2K", type: "Video" },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState("30 days");
  const maxEngagement = Math.max(...weeklyData.map(d => d.engagement));
  const maxReach = Math.max(...weeklyData.map(d => d.reach));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Analytics</h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>
            Track performance across all your connected platforms.
          </p>
        </div>
        <div className="flex gap-2">
          {dateRanges.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
              style={{
                background: range === r ? "rgba(99,102,241,0.2)" : "transparent",
                color: range === r ? "#a5b4fc" : "var(--tt-text-muted)",
                border: `1px solid ${range === r ? "rgba(99,102,241,0.4)" : "var(--tt-border)"}`,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Reach", value: "64.0K", change: "+18%", icon: "eye", color: "#6366f1" },
          { label: "Total Engagement", value: "3,247", change: "+23%", icon: "heart", color: "#ff6b6b" },
          { label: "Posts Published", value: "113", change: "+12%", icon: "document", color: "#a855f7" },
          { label: "Avg. Engagement", value: "4.6%", change: "+0.8%", icon: "chart", color: "#10b981" },
        ].map((s, i) => (
          <div key={i} className="p-5 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${s.color}15`, color: s.color }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{s.value}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{s.label}</span>
              <span className="text-xs font-medium" style={{ color: "#10b981" }}>{s.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Engagement Chart */}
        <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <h3 className="font-semibold mb-6" style={{ fontFamily: "var(--font-heading)" }}>Weekly Engagement</h3>
          <div className="flex items-end gap-3 h-48">
            {weeklyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-medium" style={{ color: "var(--tt-text-muted)" }}>{d.engagement}</span>
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${(d.engagement / maxEngagement) * 100}%`,
                    background: "linear-gradient(180deg, #6366f1, #a855f7)",
                    opacity: 0.8 + (d.engagement / maxEngagement) * 0.2,
                  }}
                />
                <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reach Chart */}
        <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <h3 className="font-semibold mb-6" style={{ fontFamily: "var(--font-heading)" }}>Weekly Reach</h3>
          <div className="flex items-end gap-3 h-48">
            {weeklyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-medium" style={{ color: "var(--tt-text-muted)" }}>{(d.reach / 1000).toFixed(1)}K</span>
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${(d.reach / maxReach) * 100}%`,
                    background: "linear-gradient(180deg, #ff6b6b, #f59e0b)",
                    opacity: 0.8 + (d.reach / maxReach) * 0.2,
                  }}
                />
                <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="p-6 rounded-2xl mb-8" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        <h3 className="font-semibold mb-6" style={{ fontFamily: "var(--font-heading)" }}>Platform Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
                <th className="text-left pb-4 font-medium">Platform</th>
                <th className="text-right pb-4 font-medium">Followers</th>
                <th className="text-right pb-4 font-medium">Engagement</th>
                <th className="text-right pb-4 font-medium">Reach</th>
                <th className="text-right pb-4 font-medium">Posts</th>
                <th className="text-right pb-4 font-medium">Growth</th>
              </tr>
            </thead>
            <tbody>
              {platformData.map((p, i) => (
                <tr key={i} className="text-sm" style={{ borderTop: "1px solid var(--tt-border)" }}>
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="text-right py-4">{p.followers}</td>
                  <td className="text-right py-4">{p.engagement}</td>
                  <td className="text-right py-4">{p.reach}</td>
                  <td className="text-right py-4">{p.posts}</td>
                  <td className="text-right py-4">
                    <span className="text-xs font-medium" style={{ color: "#10b981" }}>{p.growth}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Performing Posts */}
      <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        <h3 className="font-semibold mb-6" style={{ fontFamily: "var(--font-heading)" }}>Top Performing Posts</h3>
        <div className="space-y-3">
          {topPosts.map((post, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                #{i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{post.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{post.platform}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--tt-surface-3)", color: "var(--tt-text-muted)" }}>{post.type}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{post.engagement}</div>
                <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>engagement</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{post.reach}</div>
                <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>reach</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
