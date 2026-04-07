"use client";
import { useState } from "react";
import Link from "next/link";
import { useAdDashboardOverview } from "@/hooks/use-api";
import { ROASGauge } from "@/components/ads/ROASGauge";
import { AdPerformanceChart } from "@/components/ads/AdPerformanceChart";
import { CampaignTable } from "@/components/ads/CampaignTable";
import { BudgetAllocationWidget } from "@/components/ads/BudgetAllocationWidget";

const dateRanges = ["7d", "30d", "90d"] as const;

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

export default function AdsOverviewPage() {
  const [range, setRange] = useState<string>("30d");
  const [chartMetric, setChartMetric] = useState<"spend_revenue" | "roas">("spend_revenue");
  const [sortKey, setSortKey] = useState("spend");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data, isLoading, error } = useAdDashboardOverview(range);
  const overview = data?.data;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--tt-text)" }}>
            Ad Performance
          </h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--tt-surface)" }} />
          ))}
        </div>
        <div className="h-80 rounded-xl animate-pulse" style={{ background: "var(--tt-surface)" }} />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--tt-text)" }}>
          Ad Performance
        </h1>
        <div className="p-8 rounded-xl text-center" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
          <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--tt-text)" }}>No Ad Data Yet</h3>
          <p className="text-sm mb-4" style={{ color: "var(--tt-text-muted)" }}>
            Connect your ad accounts to start tracking performance across platforms.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
          >
            Connect Ad Accounts
          </Link>
        </div>
      </div>
    );
  }

  const { summary, campaigns, platformBreakdown, dailyTrend, anomalies } = overview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--tt-text)" }}>
            Ad Performance
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--tt-text-muted)" }}>
            Real-time ROAS tracking across all platforms
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Link
            href="/dashboard/ads/insights"
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
            style={{ background: "rgba(168,85,247,0.1)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.2)" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI Insights
          </Link>
        </div>
      </div>

      {/* Anomaly Alerts */}
      {anomalies.length > 0 && (
        <div className="space-y-2">
          {anomalies.map((alert, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
              style={{
                background: alert.severity === "critical" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                border: `1px solid ${alert.severity === "critical" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
                color: alert.severity === "critical" ? "#fca5a5" : "#fcd34d",
              }}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Spend", value: formatCurrency(summary.totalSpend), color: "#ff6b6b" },
          { label: "Revenue", value: formatCurrency(summary.totalRevenue), color: "#22c55e" },
          { label: "ROAS", value: `${summary.overallRoas.toFixed(2)}x`, color: summary.overallRoas >= 1 ? "#22c55e" : "#ef4444" },
          { label: "Clicks", value: formatNumber(summary.totalClicks), color: "#6366f1" },
          { label: "Active Campaigns", value: String(summary.activeCampaigns), color: "#a855f7" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="p-4 rounded-xl"
            style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
          >
            <div className="text-xs mb-1" style={{ color: "var(--tt-text-muted)" }}>{kpi.label}</div>
            <div className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Main Grid: Chart + ROAS Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Spend vs Revenue Chart */}
        <div
          className="lg:col-span-3 p-5 rounded-xl"
          style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "var(--tt-text)" }}>Performance Trend</h3>
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
          <AdPerformanceChart data={dailyTrend} metric={chartMetric} />
        </div>

        {/* ROAS Gauge */}
        <div
          className="p-5 rounded-xl flex flex-col items-center justify-center"
          style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--tt-text)" }}>Overall ROAS</h3>
          <ROASGauge actual={summary.overallRoas} target={3} />
          <div className="mt-4 grid grid-cols-2 gap-3 w-full text-center">
            <div>
              <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Avg CPC</div>
              <div className="text-sm font-semibold" style={{ color: "var(--tt-text)" }}>${summary.avgCpc.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Avg CTR</div>
              <div className="text-sm font-semibold" style={{ color: "var(--tt-text)" }}>{summary.avgCtr.toFixed(2)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Allocation */}
      <div
        className="p-5 rounded-xl"
        style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
      >
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--tt-text)" }}>Budget Allocation</h3>
        <BudgetAllocationWidget platformBreakdown={platformBreakdown} />
      </div>

      {/* Campaign Table */}
      <div
        className="p-5 rounded-xl"
        style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: "var(--tt-text)" }}>Campaigns</h3>
          <Link
            href="/dashboard/ads/creative"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
          >
            + New Creative
          </Link>
        </div>
        <CampaignTable
          campaigns={campaigns}
          onSort={handleSort}
          sortKey={sortKey}
          sortOrder={sortOrder}
        />
      </div>
    </div>
  );
}
