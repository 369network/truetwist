"use client";
import { useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

/* ─── TRUA-62: Advanced Analytics Dashboard with Recharts ─── */

const dateRanges = ["7 days", "30 days", "90 days", "12 months"] as const;

interface PlatformData {
  name: string;
  followers: number;
  followersDisplay: string;
  engagement: number;
  engagementDisplay: string;
  posts: number;
  reach: number;
  reachDisplay: string;
  color: string;
  growth: string;
}

const platformData: PlatformData[] = [
  { name: "Instagram", followers: 2412, followersDisplay: "2,412", engagement: 4.8, engagementDisplay: "4.8%", posts: 23, reach: 12400, reachDisplay: "12.4K", color: "#E4405F", growth: "+12%" },
  { name: "X (Twitter)", followers: 1847, followersDisplay: "1,847", engagement: 3.2, engagementDisplay: "3.2%", posts: 45, reach: 8900, reachDisplay: "8.9K", color: "#1DA1F2", growth: "+8%" },
  { name: "LinkedIn", followers: 956, followersDisplay: "956", engagement: 5.1, engagementDisplay: "5.1%", posts: 12, reach: 4200, reachDisplay: "4.2K", color: "#0A66C2", growth: "+15%" },
  { name: "TikTok", followers: 5234, followersDisplay: "5,234", engagement: 7.3, engagementDisplay: "7.3%", posts: 18, reach: 34700, reachDisplay: "34.7K", color: "#ff0050", growth: "+34%" },
  { name: "Facebook", followers: 1108, followersDisplay: "1,108", engagement: 2.8, engagementDisplay: "2.8%", posts: 15, reach: 3800, reachDisplay: "3.8K", color: "#1877F2", growth: "+5%" },
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

const monthlyTrendData = [
  { month: "Jan", engagement: 2100, reach: 14000, followers: 8200 },
  { month: "Feb", engagement: 2450, reach: 16500, followers: 8600 },
  { month: "Mar", engagement: 2800, reach: 18200, followers: 9100 },
  { month: "Apr", engagement: 3100, reach: 21000, followers: 9800 },
  { month: "May", engagement: 2900, reach: 19800, followers: 10200 },
  { month: "Jun", engagement: 3247, reach: 24500, followers: 11557 },
];

const topPosts = [
  { content: "5 AI tools that will change how you create content...", platform: "Instagram", engagement: "1.2K", reach: "8.4K", type: "Carousel" },
  { content: "Hot take: Most social media advice is outdated...", platform: "X (Twitter)", engagement: "847", reach: "12.1K", type: "Thread" },
  { content: "How I grew 10K followers in 30 days using AI...", platform: "TikTok", engagement: "2.3K", reach: "45.2K", type: "Video" },
  { content: "The future of content marketing is here...", platform: "LinkedIn", engagement: "634", reach: "5.8K", type: "Article" },
  { content: "POV: You just automated your content workflow...", platform: "TikTok", engagement: "1.8K", reach: "28.3K", type: "Video" },
];

/* ─── Comparison data for side-by-side platform view ─── */
const comparisonMetrics = [
  { metric: "Engagement Rate", instagram: 4.8, twitter: 3.2, linkedin: 5.1, tiktok: 7.3, facebook: 2.8 },
  { metric: "Post Frequency", instagram: 23, twitter: 45, linkedin: 12, tiktok: 18, facebook: 15 },
  { metric: "Avg Reach/Post", instagram: 539, twitter: 198, linkedin: 350, tiktok: 1928, facebook: 253 },
  { metric: "Growth %", instagram: 12, twitter: 8, linkedin: 15, tiktok: 34, facebook: 5 },
];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  twitter: "#1DA1F2",
  linkedin: "#0A66C2",
  tiktok: "#ff0050",
  facebook: "#1877F2",
};

type DrillDownTarget = { type: "day"; data: typeof weeklyData[0] } | { type: "platform"; data: PlatformData } | null;

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl p-3 text-xs shadow-lg"
      style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}
    >
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" && entry.value > 999 ? `${(entry.value / 1000).toFixed(1)}K` : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<typeof dateRanges[number]>("30 days");
  const [drillDown, setDrillDown] = useState<DrillDownTarget>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "twitter"]);

  const togglePlatformCompare = (key: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : prev.length < 3 ? [...prev, key] : prev
    );
  };

  /* ─── CSV Export ─── */
  const exportCSV = useCallback(() => {
    const headers = ["Platform", "Followers", "Engagement %", "Posts", "Reach", "Growth"];
    const rows = platformData.map((p) => [p.name, p.followersDisplay, p.engagementDisplay, p.posts, p.reachDisplay, p.growth]);
    const weekHeaders = ["Day", "Posts", "Engagement", "Reach"];
    const weekRows = weeklyData.map((d) => [d.day, d.posts, d.engagement, d.reach]);

    let csv = "=== Platform Performance ===\n";
    csv += headers.join(",") + "\n";
    rows.forEach((r) => (csv += r.join(",") + "\n"));
    csv += "\n=== Weekly Data ===\n";
    csv += weekHeaders.join(",") + "\n";
    weekRows.forEach((r) => (csv += r.join(",") + "\n"));

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `truetwist-analytics-${range.replace(" ", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [range]);

  /* ─── Drill-down on bar click ─── */
  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]) {
      const payload = data.activePayload[0].payload;
      if (payload.day) {
        setDrillDown({ type: "day", data: payload });
      }
    }
  };

  const handlePlatformDrillDown = (platform: PlatformData) => {
    setDrillDown({ type: "platform", data: platform });
  };

  /* ─── Reach distribution for pie chart ─── */
  const reachDistribution = platformData.map((p) => ({
    name: p.name,
    value: p.reach,
    color: p.color,
  }));

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            Analytics
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>
            Track performance across all your connected platforms.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Date Range */}
          <div className="flex gap-1.5">
            {dateRanges.map((r) => (
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

          {/* Compare Toggle */}
          <button
            onClick={() => { setCompareMode(!compareMode); setDrillDown(null); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            style={{
              background: compareMode ? "rgba(168,85,247,0.2)" : "transparent",
              color: compareMode ? "#c084fc" : "var(--tt-text-muted)",
              border: `1px solid ${compareMode ? "rgba(168,85,247,0.4)" : "var(--tt-border)"}`,
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h6" />
            </svg>
            Compare
          </button>

          {/* CSV Export */}
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            style={{
              background: "transparent",
              color: "var(--tt-text-muted)",
              border: "1px solid var(--tt-border)",
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Reach", value: "64.0K", change: "+18%", color: "#6366f1" },
          { label: "Total Engagement", value: "3,247", change: "+23%", color: "#ff6b6b" },
          { label: "Posts Published", value: "113", change: "+12%", color: "#a855f7" },
          { label: "Avg. Engagement", value: "4.6%", change: "+0.8%", color: "#10b981" },
        ].map((s, i) => (
          <div key={i} className="p-5 rounded-2xl transition-all hover:scale-[1.02]" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${s.color}15`, color: s.color }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                {i === 0 && <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />}
                {i === 0 && <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />}
                {i === 1 && <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />}
                {i === 2 && <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />}
                {i === 3 && <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />}
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

      {/* Platform Comparison Mode */}
      {compareMode && (
        <div className="mb-8">
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Platform Comparison</h3>
              <div className="flex gap-2">
                {platformData.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => togglePlatformCompare(p.name.toLowerCase().replace(/[^a-z]/g, "").replace("xtwitter", "twitter"))}
                    className="px-3 py-1 rounded-full text-xs font-medium transition"
                    style={{
                      background: selectedPlatforms.includes(p.name.toLowerCase().replace(/[^a-z]/g, "").replace("xtwitter", "twitter"))
                        ? p.color + "25"
                        : "var(--tt-surface-2)",
                      color: selectedPlatforms.includes(p.name.toLowerCase().replace(/[^a-z]/g, "").replace("xtwitter", "twitter"))
                        ? p.color
                        : "var(--tt-text-muted)",
                      border: `1px solid ${selectedPlatforms.includes(p.name.toLowerCase().replace(/[^a-z]/g, "").replace("xtwitter", "twitter")) ? p.color + "50" : "var(--tt-border)"}`,
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonMetrics} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" />
                  <XAxis dataKey="metric" tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {selectedPlatforms.map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={platformData.find((p) => p.name.toLowerCase().replace(/[^a-z]/g, "").replace("xtwitter", "twitter") === key)?.name || key}
                      fill={PLATFORM_COLORS[key] || "#6366f1"}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-xs mt-4" style={{ color: "var(--tt-text-muted)" }}>
              Select up to 3 platforms to compare. Click any bar to drill down.
            </p>
          </div>
        </div>
      )}

      {/* Charts Row */}
      {!compareMode && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Engagement Bar Chart */}
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <h3 className="font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Weekly Engagement</h3>
            <p className="text-xs mb-4" style={{ color: "var(--tt-text-muted)" }}>Click a bar to drill down</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} onClick={handleBarClick} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="engagement" name="Engagement" fill="url(#engagementGradient)" radius={[6, 6, 0, 0]} cursor="pointer" />
                  <defs>
                    <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reach Area Chart */}
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <h3 className="font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Weekly Reach</h3>
            <p className="text-xs mb-4" style={{ color: "var(--tt-text-muted)" }}>Audience reach trend</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="reach"
                    name="Reach"
                    stroke="#ff6b6b"
                    fill="url(#reachGradient)"
                    strokeWidth={2}
                  />
                  <defs>
                    <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff6b6b" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ff6b6b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Growth Trend + Reach Distribution */}
      {!compareMode && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Monthly Growth Trend */}
          <div className="lg:col-span-2 p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <h3 className="font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Growth Trend</h3>
            <p className="text-xs mb-4" style={{ color: "var(--tt-text-muted)" }}>6-month engagement, reach & follower growth</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="engagement" name="Engagement" stroke="#6366f1" fill="url(#trendEngagement)" strokeWidth={2} />
                  <Area type="monotone" dataKey="reach" name="Reach" stroke="#ff6b6b" fill="url(#trendReach)" strokeWidth={2} />
                  <Area type="monotone" dataKey="followers" name="Followers" stroke="#a855f7" fill="url(#trendFollowers)" strokeWidth={2} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <defs>
                    <linearGradient id="trendEngagement" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="trendReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff6b6b" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#ff6b6b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="trendFollowers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reach Distribution Pie */}
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <h3 className="font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Reach by Platform</h3>
            <p className="text-xs mb-4" style={{ color: "var(--tt-text-muted)" }}>Distribution breakdown</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reachDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    cursor="pointer"
                  >
                    {reachDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${(value / 1000).toFixed(1)}K`, "Reach"]}
                    contentStyle={{
                      background: "var(--tt-surface-2)",
                      border: "1px solid var(--tt-border)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {reachDistribution.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                    <span style={{ color: "var(--tt-text-muted)" }}>{item.name}</span>
                  </div>
                  <span className="font-medium">{(item.value / 1000).toFixed(1)}K</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Drill-Down Panel */}
      {drillDown && (
        <div className="mb-8 p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid rgba(99,102,241,0.3)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
              <svg className="w-4 h-4" style={{ color: "#6366f1" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              {drillDown.type === "day" ? `${drillDown.data.day} Breakdown` : `${drillDown.data.name} Details`}
            </h3>
            <button
              onClick={() => setDrillDown(null)}
              className="text-xs px-3 py-1 rounded-lg transition"
              style={{ background: "var(--tt-surface-2)", color: "var(--tt-text-muted)", border: "1px solid var(--tt-border)" }}
            >
              Close
            </button>
          </div>

          {drillDown.type === "day" && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Posts", value: drillDown.data.posts, color: "#6366f1" },
                { label: "Engagement", value: drillDown.data.engagement, color: "#ff6b6b" },
                { label: "Reach", value: drillDown.data.reach.toLocaleString(), color: "#a855f7" },
              ].map((metric, i) => (
                <div key={i} className="p-4 rounded-xl text-center" style={{ background: "var(--tt-surface-2)" }}>
                  <div className="text-2xl font-bold" style={{ color: metric.color, fontFamily: "var(--font-heading)" }}>
                    {metric.value}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--tt-text-muted)" }}>{metric.label}</div>
                </div>
              ))}
            </div>
          )}

          {drillDown.type === "platform" && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Followers", value: drillDown.data.followersDisplay },
                { label: "Engagement", value: drillDown.data.engagementDisplay },
                { label: "Posts", value: drillDown.data.posts.toString() },
                { label: "Reach", value: drillDown.data.reachDisplay },
                { label: "Growth", value: drillDown.data.growth },
              ].map((metric, i) => (
                <div key={i} className="p-4 rounded-xl text-center" style={{ background: "var(--tt-surface-2)" }}>
                  <div className="text-lg font-bold" style={{ color: drillDown.data.color, fontFamily: "var(--font-heading)" }}>
                    {metric.value}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--tt-text-muted)" }}>{metric.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Platform Breakdown Table */}
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
                <tr
                  key={i}
                  className="text-sm cursor-pointer transition hover:bg-white/[0.03]"
                  style={{ borderTop: "1px solid var(--tt-border)" }}
                  onClick={() => handlePlatformDrillDown(p)}
                >
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="text-right py-4">{p.followersDisplay}</td>
                  <td className="text-right py-4">{p.engagementDisplay}</td>
                  <td className="text-right py-4">{p.reachDisplay}</td>
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
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl transition hover:bg-white/[0.02]" style={{ background: "var(--tt-surface-2)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                #{i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{post.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{post.platform}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--tt-surface-3)", color: "var(--tt-text-muted)" }}>
                    {post.type}
                  </span>
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
