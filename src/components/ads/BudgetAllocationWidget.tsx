"use client";

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

interface PlatformData {
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

interface BudgetAllocationWidgetProps {
  platformBreakdown: Record<string, PlatformData>;
  recommendations?: Array<{
    title: string;
    description: string;
    action: string;
  }>;
}

export function BudgetAllocationWidget({ platformBreakdown, recommendations }: BudgetAllocationWidgetProps) {
  const platforms = Object.entries(platformBreakdown);
  const totalSpend = platforms.reduce((sum, [, d]) => sum + d.spend, 0);

  return (
    <div className="space-y-4">
      {/* Budget Split Visualization */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: "var(--tt-text)" }}>Budget Split</span>
          <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
            Total: ${totalSpend.toFixed(0)}
          </span>
        </div>

        {/* Stacked bar */}
        <div className="h-4 rounded-full overflow-hidden flex" style={{ background: "var(--tt-surface-2)" }}>
          {platforms.map(([platform, data]) => {
            const pct = totalSpend > 0 ? (data.spend / totalSpend) * 100 : 0;
            return (
              <div
                key={platform}
                className="h-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: PLATFORM_COLORS[platform] || "#6b7280",
                  minWidth: pct > 0 ? "4px" : 0,
                }}
                title={`${PLATFORM_LABELS[platform] || platform}: ${pct.toFixed(1)}%`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3">
          {platforms.map(([platform, data]) => {
            const pct = totalSpend > 0 ? (data.spend / totalSpend) * 100 : 0;
            const roas = data.spend > 0 ? data.revenue / data.spend : 0;
            return (
              <div key={platform} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: PLATFORM_COLORS[platform] || "#6b7280" }} />
                <div>
                  <span className="text-xs font-medium" style={{ color: "var(--tt-text)" }}>
                    {PLATFORM_LABELS[platform] || platform}
                  </span>
                  <span className="text-xs ml-1" style={{ color: "var(--tt-text-muted)" }}>
                    {pct.toFixed(0)}%
                  </span>
                  <span className="text-xs ml-1" style={{ color: roas >= 1 ? "#22c55e" : "#ef4444" }}>
                    ({roas.toFixed(1)}x)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Platform Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {platforms.map(([platform, data]) => {
          const roas = data.spend > 0 ? data.revenue / data.spend : 0;
          const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
          return (
            <div
              key={platform}
              className="p-3 rounded-xl"
              style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: PLATFORM_COLORS[platform] }} />
                <span className="text-xs font-medium" style={{ color: "var(--tt-text)" }}>
                  {PLATFORM_LABELS[platform] || platform}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div style={{ color: "var(--tt-text-muted)" }}>Spend</div>
                  <div className="font-medium" style={{ color: "var(--tt-text)" }}>${data.spend.toFixed(0)}</div>
                </div>
                <div>
                  <div style={{ color: "var(--tt-text-muted)" }}>ROAS</div>
                  <div className="font-medium" style={{ color: roas >= 1 ? "#22c55e" : "#ef4444" }}>{roas.toFixed(2)}x</div>
                </div>
                <div>
                  <div style={{ color: "var(--tt-text-muted)" }}>CTR</div>
                  <div className="font-medium" style={{ color: "var(--tt-text)" }}>{ctr.toFixed(2)}%</div>
                </div>
                <div>
                  <div style={{ color: "var(--tt-text-muted)" }}>Conv.</div>
                  <div className="font-medium" style={{ color: "var(--tt-text)" }}>{data.conversions}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: "#a5b4fc" }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI Recommendations
          </span>
          {recommendations.map((rec, i) => (
            <div
              key={i}
              className="p-3 rounded-lg text-xs"
              style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)" }}
            >
              <div className="font-medium mb-0.5" style={{ color: "var(--tt-text)" }}>{rec.title}</div>
              <div style={{ color: "var(--tt-text-muted)" }}>{rec.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
