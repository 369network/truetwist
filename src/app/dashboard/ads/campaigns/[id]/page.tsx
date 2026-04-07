"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAdCampaignMetrics } from "@/hooks/use-api";
import { AdPerformanceChart } from "@/components/ads/AdPerformanceChart";
import { ROASGauge } from "@/components/ads/ROASGauge";

const dateRanges = ["7d", "30d", "90d"] as const;

const PLATFORM_COLORS: Record<string, string> = {
  meta: "#1877F2",
  google: "#4285F4",
  tiktok: "#ff0050",
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok Ads",
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: "rgba(34,197,94,0.1)", color: "#22c55e", label: "Active" },
  paused: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b", label: "Paused" },
  deleted: { bg: "rgba(239,68,68,0.1)", color: "#ef4444", label: "Deleted" },
  archived: { bg: "rgba(107,114,128,0.1)", color: "#6b7280", label: "Archived" },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [range, setRange] = useState<string>("30d");
  const [chartMetric, setChartMetric] = useState<"spend_revenue" | "roas">("spend_revenue");

  const { data, isLoading } = useAdCampaignMetrics(id, range);
  const detail = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: "var(--tt-surface)" }} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--tt-surface)" }} />
          ))}
        </div>
        <div className="h-80 rounded-xl animate-pulse" style={{ background: "var(--tt-surface)" }} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-12">
        <p style={{ color: "var(--tt-text-muted)" }}>Campaign not found</p>
        <Link href="/dashboard/ads" className="text-sm mt-2 inline-block" style={{ color: "#a5b4fc" }}>
          Back to Ad Performance
        </Link>
      </div>
    );
  }

  const { campaign, summary, dailyMetrics } = detail;
  const statusStyle = STATUS_STYLES[campaign.status] || STATUS_STYLES.archived;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link href="/dashboard/ads" className="text-xs flex items-center gap-1 mb-3" style={{ color: "var(--tt-text-muted)" }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Ad Performance
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--tt-text)" }}>
              {campaign.name}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{ background: (PLATFORM_COLORS[campaign.platform] || "#6b7280") + "20", color: PLATFORM_COLORS[campaign.platform] || "#6b7280" }}
              >
                {PLATFORM_LABELS[campaign.platform] || campaign.platform}
              </span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{ background: statusStyle.bg, color: statusStyle.color }}
              >
                {statusStyle.label}
              </span>
              <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
                {campaign.objective} &middot; {campaign.accountName}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {dateRanges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: range === r ? "rgba(99,102,241,0.15)" : "transparent",
                  color: range === r ? "#a5b4fc" : "var(--tt-text-muted)",
                  border: `1px solid ${range === r ? "rgba(99,102,241,0.3)" : "var(--tt-border)"}`,
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Spend", value: formatCurrency(summary.spend), color: "#ff6b6b" },
          { label: "Revenue", value: formatCurrency(summary.revenue), color: "#22c55e" },
          { label: "ROAS", value: `${summary.roas.toFixed(2)}x`, color: summary.roas >= 1 ? "#22c55e" : "#ef4444" },
          { label: "Clicks", value: formatNumber(summary.clicks), sub: `CTR: ${summary.ctr.toFixed(2)}%`, color: "#6366f1" },
          { label: "Conversions", value: formatNumber(summary.conversions), sub: `Rate: ${summary.conversionRate.toFixed(2)}%`, color: "#a855f7" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="p-4 rounded-xl"
            style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
          >
            <div className="text-xs mb-1" style={{ color: "var(--tt-text-muted)" }}>{kpi.label}</div>
            <div className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
            {"sub" in kpi && kpi.sub && (
              <div className="text-xs mt-0.5" style={{ color: "var(--tt-text-muted)" }}>{kpi.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* Chart + Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div
          className="lg:col-span-3 p-5 rounded-xl"
          style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "var(--tt-text)" }}>Daily Metrics</h3>
            <div className="flex gap-1.5">
              {(["spend_revenue", "roas"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setChartMetric(m)}
                  className="px-2.5 py-1 rounded-lg text-xs transition-all"
                  style={{
                    background: chartMetric === m ? "rgba(99,102,241,0.15)" : "transparent",
                    color: chartMetric === m ? "#a5b4fc" : "var(--tt-text-muted)",
                  }}
                >
                  {m === "spend_revenue" ? "Spend & Revenue" : "ROAS"}
                </button>
              ))}
            </div>
          </div>
          <AdPerformanceChart data={dailyMetrics} metric={chartMetric} />
        </div>

        <div
          className="p-5 rounded-xl flex flex-col items-center justify-center"
          style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--tt-text)" }}>Campaign ROAS</h3>
          <ROASGauge actual={summary.roas} target={3} />
          <div className="mt-4 grid grid-cols-2 gap-3 w-full text-center">
            <div>
              <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>CPC</div>
              <div className="text-sm font-semibold" style={{ color: "var(--tt-text)" }}>${summary.cpc.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>CTR</div>
              <div className="text-sm font-semibold" style={{ color: "var(--tt-text)" }}>{summary.ctr.toFixed(2)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Metrics Table */}
      <div
        className="p-5 rounded-xl"
        style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
      >
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--tt-text)" }}>Daily Breakdown</h3>
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--tt-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--tt-surface-2)" }}>
                {["Date", "Spend", "Revenue", "ROAS", "Impressions", "Clicks", "CTR", "CPC"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium" style={{ color: "var(--tt-text-muted)", borderBottom: "1px solid var(--tt-border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dailyMetrics.slice().reverse().map((m) => (
                <tr key={m.date} className="hover:bg-white/[0.02]" style={{ borderBottom: "1px solid var(--tt-border)" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--tt-text)" }}>
                    {new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "#ff6b6b" }}>{formatCurrency(m.spend)}</td>
                  <td className="px-4 py-2.5" style={{ color: "#22c55e" }}>{formatCurrency(m.revenue)}</td>
                  <td className="px-4 py-2.5" style={{ color: m.roas >= 1 ? "#22c55e" : "#ef4444" }}>{m.roas.toFixed(2)}x</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--tt-text-muted)" }}>{formatNumber(m.impressions)}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--tt-text-muted)" }}>{formatNumber(m.clicks)}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--tt-text-muted)" }}>{m.ctr.toFixed(2)}%</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--tt-text-muted)" }}>{formatCurrency(m.cpc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
