"use client";
import Link from "next/link";
import { useState } from "react";
import type { AdCampaignRow } from "@/lib/api-client";

const PLATFORM_COLORS: Record<string, string> = {
  meta: "#1877F2",
  google: "#4285F4",
  tiktok: "#ff0050",
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  active: { bg: "rgba(34,197,94,0.1)", color: "#22c55e" },
  paused: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b" },
  deleted: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
  archived: { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
};

interface CampaignTableProps {
  campaigns: AdCampaignRow[];
  onSort?: (key: string) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

function MiniSparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const width = 80;
  const height = 24;
  const points = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * width},${height - (v / max) * height}`).join(" ");

  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline points={points} fill="none" stroke="#6366f1" strokeWidth={1.5} />
    </svg>
  );
}

export function CampaignTable({ campaigns, onSort, sortKey, sortOrder }: CampaignTableProps) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? campaigns : campaigns.filter((c) => c.platform === filter);

  const columns = [
    { key: "name", label: "Campaign" },
    { key: "spend", label: "Spend" },
    { key: "revenue", label: "Revenue" },
    { key: "roas", label: "ROAS" },
    { key: "impressions", label: "Impressions" },
    { key: "clicks", label: "Clicks" },
    { key: "ctr", label: "CTR" },
    { key: "conversions", label: "Conv." },
    { key: "cpc", label: "CPC" },
  ];

  return (
    <div>
      {/* Platform filter */}
      <div className="flex gap-2 mb-4">
        {["all", "meta", "google", "tiktok"].map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: filter === p ? "rgba(99,102,241,0.15)" : "transparent",
              color: filter === p ? "#a5b4fc" : "var(--tt-text-muted)",
              border: `1px solid ${filter === p ? "rgba(99,102,241,0.3)" : "var(--tt-border)"}`,
            }}
          >
            {p === "all" ? "All Platforms" : PLATFORM_LABELS[p] || p}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--tt-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--tt-surface-2)" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left font-medium cursor-pointer select-none"
                  style={{ color: "var(--tt-text-muted)", borderBottom: "1px solid var(--tt-border)" }}
                  onClick={() => onSort?.(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
                    )}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--tt-text-muted)", borderBottom: "1px solid var(--tt-border)" }}>
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((campaign) => {
              const statusStyle = STATUS_STYLES[campaign.status] || STATUS_STYLES.archived;
              return (
                <tr
                  key={campaign.id}
                  className="transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: "1px solid var(--tt-border)" }}
                >
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/ads/campaigns/${campaign.id}`} className="hover:underline">
                      <div className="font-medium" style={{ color: "var(--tt-text)" }}>{campaign.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ background: PLATFORM_COLORS[campaign.platform] + "20", color: PLATFORM_COLORS[campaign.platform] }}
                        >
                          {PLATFORM_LABELS[campaign.platform] || campaign.platform}
                        </span>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ background: statusStyle.bg, color: statusStyle.color }}
                        >
                          {campaign.status}
                        </span>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--tt-text)" }}>{formatCurrency(campaign.spend)}</td>
                  <td className="px-4 py-3" style={{ color: "#22c55e" }}>{formatCurrency(campaign.revenue)}</td>
                  <td className="px-4 py-3">
                    <span style={{ color: campaign.roas >= 1 ? "#22c55e" : "#ef4444" }}>
                      {campaign.roas.toFixed(2)}x
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--tt-text-muted)" }}>{formatNumber(campaign.impressions)}</td>
                  <td className="px-4 py-3" style={{ color: "var(--tt-text-muted)" }}>{formatNumber(campaign.clicks)}</td>
                  <td className="px-4 py-3" style={{ color: "var(--tt-text-muted)" }}>{campaign.ctr.toFixed(2)}%</td>
                  <td className="px-4 py-3" style={{ color: "var(--tt-text-muted)" }}>{formatNumber(campaign.conversions)}</td>
                  <td className="px-4 py-3" style={{ color: "var(--tt-text-muted)" }}>{formatCurrency(campaign.cpc)}</td>
                  <td className="px-4 py-3">
                    <MiniSparkline data={campaign.dailyMetrics?.map((m) => m.spend) || []} />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center" style={{ color: "var(--tt-text-muted)" }}>
                  No campaigns found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
