"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DailyMetric {
  date: string;
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
}

interface AdPerformanceChartProps {
  data: DailyMetric[];
  metric?: "spend_revenue" | "roas" | "impressions" | "clicks";
}

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
          {entry.name}: {entry.name === "ROAS" ? `${entry.value.toFixed(2)}x` : `$${entry.value.toFixed(2)}`}
        </p>
      ))}
    </div>
  );
}

export function AdPerformanceChart({ data, metric = "spend_revenue" }: AdPerformanceChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  if (metric === "roas") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="roasGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" />
          <XAxis dataKey="date" tick={{ fill: "var(--tt-text-muted)", fontSize: 11 }} />
          <YAxis tick={{ fill: "var(--tt-text-muted)", fontSize: 11 }} tickFormatter={(v) => `${v}x`} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="roas" name="ROAS" stroke="#a855f7" fill="url(#roasGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" />
        <XAxis dataKey="date" tick={{ fill: "var(--tt-text-muted)", fontSize: 11 }} />
        <YAxis tick={{ fill: "var(--tt-text-muted)", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="spend" name="Spend" stroke="#ff6b6b" fill="url(#spendGradient)" strokeWidth={2} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#22c55e" fill="url(#revenueGradient)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
