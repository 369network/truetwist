"use client";
import Link from "next/link";
import { useAdInsights } from "@/hooks/use-api";

const PRIORITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  high: { bg: "rgba(239,68,68,0.06)", color: "#fca5a5", border: "rgba(239,68,68,0.15)" },
  medium: { bg: "rgba(245,158,11,0.06)", color: "#fcd34d", border: "rgba(245,158,11,0.15)" },
  low: { bg: "rgba(34,197,94,0.06)", color: "#86efac", border: "rgba(34,197,94,0.15)" },
};

const TYPE_ICONS: Record<string, string> = {
  scale_budget: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z",
  optimize_campaign: "M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75",
  creative_fatigue: "M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42",
  reallocate_budget: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
};

export default function AdsInsightsPage() {
  const { data, isLoading } = useAdInsights();
  const insightsData = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--tt-text)" }}>
          AI Budget Insights
        </h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "var(--tt-surface)" }} />
          ))}
        </div>
      </div>
    );
  }

  const insights = insightsData?.insights || [];
  const platformPerf = insightsData?.platformPerformance || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/ads" className="text-xs flex items-center gap-1 mb-3" style={{ color: "var(--tt-text-muted)" }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Ad Performance
          </Link>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--tt-text)" }}>
            AI Budget Insights
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--tt-text-muted)" }}>
            AI-powered recommendations to optimize your ad spend
          </p>
        </div>
        {insightsData?.generatedAt && (
          <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
            Updated {new Date(insightsData.generatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Platform ROAS Comparison */}
      {Object.keys(platformPerf).length > 0 && (
        <div
          className="p-5 rounded-xl"
          style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--tt-text)" }}>Platform ROAS Comparison</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(platformPerf).map(([platform, perf]) => {
              const platformColors: Record<string, string> = { meta: "#1877F2", google: "#4285F4", tiktok: "#ff0050" };
              const platformLabels: Record<string, string> = { meta: "Meta Ads", google: "Google Ads", tiktok: "TikTok Ads" };
              return (
                <div
                  key={platform}
                  className="p-4 rounded-xl"
                  style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: platformColors[platform] || "#6b7280" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--tt-text)" }}>
                      {platformLabels[platform] || platform}
                    </span>
                  </div>
                  <div className="text-2xl font-bold mb-1" style={{ color: perf.roas >= 1 ? "#22c55e" : "#ef4444" }}>
                    {perf.roas.toFixed(2)}x
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: "var(--tt-text-muted)" }}>
                    <span>Spend: ${perf.spend.toFixed(0)}</span>
                    <span>Revenue: ${perf.revenue.toFixed(0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Insights List */}
      {insights.length === 0 ? (
        <div
          className="p-8 rounded-xl text-center"
          style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
        >
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--tt-text)" }}>No Insights Available</h3>
          <p className="text-sm" style={{ color: "var(--tt-text-muted)" }}>
            Insights will appear once you have active campaigns with enough performance data.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight, i) => {
            const style = PRIORITY_STYLES[insight.priority] || PRIORITY_STYLES.low;
            const iconPath = TYPE_ICONS[insight.type] || TYPE_ICONS.optimize_campaign;
            return (
              <div
                key={i}
                className="p-5 rounded-xl"
                style={{ background: style.bg, border: `1px solid ${style.border}` }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${style.color}15` }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={style.color} strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold" style={{ color: "var(--tt-text)" }}>{insight.title}</h4>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase"
                        style={{ background: `${style.color}20`, color: style.color }}
                      >
                        {insight.priority}
                      </span>
                    </div>
                    <p className="text-sm mb-2" style={{ color: "var(--tt-text-muted)" }}>{insight.description}</p>
                    <div className="flex flex-wrap gap-4 text-xs">
                      <div>
                        <span style={{ color: "var(--tt-text-muted)" }}>Impact: </span>
                        <span style={{ color: "#22c55e" }}>{insight.impact}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--tt-text-muted)" }}>Action: </span>
                        <span style={{ color: "#a5b4fc" }}>{insight.action}</span>
                      </div>
                    </div>
                    {insight.campaignId && (
                      <Link
                        href={`/dashboard/ads/campaigns/${insight.campaignId}`}
                        className="inline-flex items-center gap-1 text-xs mt-2"
                        style={{ color: "#818cf8" }}
                      >
                        View Campaign →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
