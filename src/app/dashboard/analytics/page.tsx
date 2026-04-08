"use client";
import { useState, useEffect, useCallback } from "react";
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
import {
  analyticsApi,
  type AnalyticsOverview,
  type PlatformMetrics,
  type AnalyticsPost,
  type GrowthDataPoint,
} from "@/lib/api-client";

/* ─── TRUA-149: Wire Analytics to real data endpoints ─── */

const dateRanges = ["7d", "30d", "90d"] as const;
type DateRange = typeof dateRanges[number];

const rangeLabels: Record<DateRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  twitter: "#1DA1F2",
  linkedin: "#0A66C2",
  tiktok: "#ff0050",
  facebook: "#1877F2",
  youtube: "#FF0000",
  threads: "#000000",
  pinterest: "#E60023",
};

function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform.toLowerCase()] || "#6366f1";
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function changeStr(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}%`;
}

type DrillDownTarget =
  | { type: "platform"; platform: string; data: PlatformMetrics }
  | { type: "day"; data: GrowthDataPoint }
  | null;

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
          {entry.name}: {typeof entry.value === "number" && entry.value > 999 ? formatNum(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>("30d");
  const [drillDown, setDrillDown] = useState<DrillDownTarget>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Data state
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [platforms, setPlatforms] = useState<Record<string, PlatformMetrics> | null>(null);
  const [topPosts, setTopPosts] = useState<AnalyticsPost[]>([]);
  const [growthData, setGrowthData] = useState<GrowthDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDrillDown(null);

    Promise.all([
      analyticsApi.getOverview(range).catch(() => null),
      analyticsApi.getPlatforms(range).catch(() => null),
      analyticsApi.getTopPosts({ range, sortBy: "engagementRate", limit: 5 }).catch(() => null),
      analyticsApi.getGrowth(range).catch(() => null),
    ])
      .then(([overviewRes, platformsRes, postsRes, growthRes]) => {
        setOverview(overviewRes?.data ?? null);
        const plats = platformsRes?.data?.platforms ?? null;
        setPlatforms(plats);
        setTopPosts(postsRes?.data ?? []);
        setGrowthData(growthRes?.data?.series ?? []);

        // Default compare platforms to first 2
        if (plats && selectedPlatforms.length === 0) {
          const keys = Object.keys(plats);
          setSelectedPlatforms(keys.slice(0, Math.min(2, keys.length)));
        }
      })
      .catch((err) => setError(err.message || "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlatformCompare = (key: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : prev.length < 3 ? [...prev, key] : prev
    );
  };

  /* ─── CSV Export via server-side endpoint ─── */
  const exportCSV = useCallback(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const url = analyticsApi.exportData({ range, format: "csv" });
    const a = document.createElement("a");
    // For auth, we open in a new window or fetch and download
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          if (!res.ok) throw new Error("Export failed");
          return res.blob();
        })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          a.href = blobUrl;
          a.download = `truetwist-analytics-${range}.csv`;
          a.click();
          URL.revokeObjectURL(blobUrl);
        })
        .catch(() => {
          // Fallback: direct navigation
          window.open(url, "_blank");
        });
    } else {
      window.open(url, "_blank");
    }
  }, [range]);

  const handlePlatformDrillDown = (platform: string, data: PlatformMetrics) => {
    setDrillDown({ type: "platform", platform, data });
  };

  /* ─── Derived data ─── */
  const platformEntries = platforms ? Object.entries(platforms) : [];
  const hasData = overview !== null || platformEntries.length > 0;

  const reachDistribution = platformEntries.map(([name, data]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: data.reach,
    color: getPlatformColor(name),
  }));

  // Comparison metrics for compare mode
  const comparisonMetrics = platforms
    ? [
        {
          metric: "Engagement Rate",
          ...Object.fromEntries(platformEntries.map(([k, v]) => [k, v.engagementRate])),
        },
        {
          metric: "Posts",
          ...Object.fromEntries(platformEntries.map(([k, v]) => [k, v.posts])),
        },
        {
          metric: "Reach",
          ...Object.fromEntries(platformEntries.map(([k, v]) => [k, v.reach])),
        },
        {
          metric: "Impressions",
          ...Object.fromEntries(platformEntries.map(([k, v]) => [k, v.impressions])),
        },
      ]
    : [];

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--tt-border)", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "var(--tt-text-muted)" }}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="font-medium" style={{ color: "#ef4444" }}>Something went wrong</p>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>{error}</p>
          <button
            onClick={() => setRange(range)}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.4)" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ─── Empty state ─── */
  if (!hasData) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Analytics</h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>
            Track performance across all your connected platforms.
          </p>
        </div>
        <div
          className="flex flex-col items-center justify-center p-16 rounded-2xl text-center"
          style={{ background: "var(--tt-surface)", border: "2px dashed var(--tt-border)" }}
        >
          <svg className="w-12 h-12 mb-4" style={{ color: "var(--tt-text-muted)", opacity: 0.4 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>No data yet</h2>
          <p className="text-sm mt-2 max-w-md" style={{ color: "var(--tt-text-muted)" }}>
            Connect your social media accounts and start publishing posts to see your analytics here.
          </p>
        </div>
      </div>
    );
  }

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
                {rangeLabels[r]}
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
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Reach", value: formatNum(overview.totalReach), change: changeStr(overview.changes.impressions), color: "#6366f1" },
            { label: "Total Engagement", value: formatNum(overview.totalEngagements), change: changeStr(overview.changes.engagements), color: "#ff6b6b" },
            { label: "Posts Published", value: formatNum(overview.postCount), change: "", color: "#a855f7" },
            { label: "Avg. Engagement", value: `${overview.engagementRate}%`, change: changeStr(overview.changes.engagementRate), color: "#10b981" },
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
                {s.change && (
                  <span className="text-xs font-medium" style={{ color: s.change.startsWith("-") ? "#ef4444" : "#10b981" }}>{s.change}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Platform Comparison Mode */}
      {compareMode && platformEntries.length > 0 && (
        <div className="mb-8">
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Platform Comparison</h3>
              <div className="flex gap-2">
                {platformEntries.map(([name]) => (
                  <button
                    key={name}
                    onClick={() => togglePlatformCompare(name)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition capitalize"
                    style={{
                      background: selectedPlatforms.includes(name) ? getPlatformColor(name) + "25" : "var(--tt-surface-2)",
                      color: selectedPlatforms.includes(name) ? getPlatformColor(name) : "var(--tt-text-muted)",
                      border: `1px solid ${selectedPlatforms.includes(name) ? getPlatformColor(name) + "50" : "var(--tt-border)"}`,
                    }}
                  >
                    {name}
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
                      name={key.charAt(0).toUpperCase() + key.slice(1)}
                      fill={getPlatformColor(key)}
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
      {!compareMode && growthData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Engagement Bar Chart */}
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <h3 className="font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Engagement Over Time</h3>
            <p className="text-xs mb-4" style={{ color: "var(--tt-text-muted)" }}>Total engagement by period</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growthData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="engagements" name="Engagement" fill="url(#engagementGradient)" radius={[6, 6, 0, 0]} />
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
            <h3 className="font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Reach Over Time</h3>
            <p className="text-xs mb-4" style={{ color: "var(--tt-text-muted)" }}>Audience reach trend</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
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
      {!compareMode && (growthData.length > 0 || reachDistribution.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Multi-metric Growth Trend */}
          {growthData.length > 0 && (
            <div className="lg:col-span-2 p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
              <h3 className="font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Growth Trend</h3>
              <p className="text-xs mb-4" style={{ color: "var(--tt-text-muted)" }}>Engagement, reach & post volume over time</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" vertical={false} />
                    <XAxis dataKey="period" tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--tt-text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="engagements" name="Engagement" stroke="#6366f1" fill="url(#trendEngagement)" strokeWidth={2} />
                    <Area type="monotone" dataKey="reach" name="Reach" stroke="#ff6b6b" fill="url(#trendReach)" strokeWidth={2} />
                    <Area type="monotone" dataKey="impressions" name="Impressions" stroke="#a855f7" fill="url(#trendImpressions)" strokeWidth={2} />
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
                      <linearGradient id="trendImpressions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Reach Distribution Pie */}
          {reachDistribution.length > 0 && (
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
                    >
                      {reachDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatNum(value), "Reach"]}
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
                    <span className="font-medium">{formatNum(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
              {drillDown.type === "platform"
                ? `${drillDown.platform.charAt(0).toUpperCase() + drillDown.platform.slice(1)} Details`
                : `${drillDown.data.period} Breakdown`}
            </h3>
            <button
              onClick={() => setDrillDown(null)}
              className="text-xs px-3 py-1 rounded-lg transition"
              style={{ background: "var(--tt-surface-2)", color: "var(--tt-text-muted)", border: "1px solid var(--tt-border)" }}
            >
              Close
            </button>
          </div>

          {drillDown.type === "platform" && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Followers", value: formatNum(drillDown.data.followers) },
                { label: "Engagement", value: `${drillDown.data.engagementRate}%` },
                { label: "Posts", value: String(drillDown.data.posts) },
                { label: "Reach", value: formatNum(drillDown.data.reach) },
                { label: "Clicks", value: formatNum(drillDown.data.clicks) },
              ].map((metric, i) => (
                <div key={i} className="p-4 rounded-xl text-center" style={{ background: "var(--tt-surface-2)" }}>
                  <div className="text-lg font-bold" style={{ color: getPlatformColor(drillDown.platform), fontFamily: "var(--font-heading)" }}>
                    {metric.value}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--tt-text-muted)" }}>{metric.label}</div>
                </div>
              ))}
            </div>
          )}

          {drillDown.type === "day" && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Posts", value: String(drillDown.data.postCount), color: "#6366f1" },
                { label: "Engagement", value: formatNum(drillDown.data.engagements), color: "#ff6b6b" },
                { label: "Reach", value: formatNum(drillDown.data.reach), color: "#a855f7" },
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
        </div>
      )}

      {/* Platform Breakdown Table */}
      {platformEntries.length > 0 && (
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
                  <th className="text-right pb-4 font-medium">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {platformEntries.map(([name, data], i) => (
                  <tr
                    key={i}
                    className="text-sm cursor-pointer transition hover:bg-white/[0.03]"
                    style={{ borderTop: "1px solid var(--tt-border)" }}
                    onClick={() => handlePlatformDrillDown(name, data)}
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ background: getPlatformColor(name) }} />
                        <span className="font-medium capitalize">{name}</span>
                      </div>
                    </td>
                    <td className="text-right py-4">{formatNum(data.followers)}</td>
                    <td className="text-right py-4">{data.engagementRate}%</td>
                    <td className="text-right py-4">{formatNum(data.reach)}</td>
                    <td className="text-right py-4">{data.posts}</td>
                    <td className="text-right py-4">{formatNum(data.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Performing Posts */}
      {topPosts.length > 0 && (
        <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <h3 className="font-semibold mb-6" style={{ fontFamily: "var(--font-heading)" }}>Top Performing Posts</h3>
          <div className="space-y-3">
            {topPosts.map((post, i) => (
              <div key={post.scheduleId} className="flex items-center gap-4 p-4 rounded-xl transition hover:bg-white/[0.02]" style={{ background: "var(--tt-surface-2)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{post.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs capitalize" style={{ color: "var(--tt-text-muted)" }}>{post.platform}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: "var(--tt-surface-3)", color: "var(--tt-text-muted)" }}>
                      {post.contentType}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{formatNum(post.likes + post.comments + post.shares + post.saves)}</div>
                  <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>engagement</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{formatNum(post.reach)}</div>
                  <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>reach</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
