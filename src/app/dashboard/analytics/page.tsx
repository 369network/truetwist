"use client";

const platformData = [
  { name: "Instagram", followers: "2.4K", engagement: "4.8%", posts: 23, color: "#e91e63", growth: "+12%" },
  { name: "X (Twitter)", followers: "1.8K", engagement: "3.2%", posts: 45, color: "#1da1f2", growth: "+8%" },
  { name: "LinkedIn", followers: "956", engagement: "5.1%", posts: 12, color: "#0077b5", growth: "+15%" },
  { name: "TikTok", followers: "5.2K", engagement: "7.3%", posts: 18, color: "#00f2ea", growth: "+34%" },
  { name: "Facebook", followers: "1.1K", engagement: "2.8%", posts: 15, color: "#1877f2", growth: "+5%" },
];

const weeklyData = [
  { day: "Mon", posts: 3, engagement: 245 },
  { day: "Tue", posts: 5, engagement: 412 },
  { day: "Wed", posts: 2, engagement: 189 },
  { day: "Thu", posts: 7, engagement: 567 },
  { day: "Fri", posts: 4, engagement: 323 },
  { day: "Sat", posts: 6, engagement: 478 },
  { day: "Sun", posts: 3, engagement: 289 },
];

export default function AnalyticsPage() {
  const maxEngagement = Math.max(...weeklyData.map(d => d.engagement));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Analytics</h1>
      <p className="text-sm mb-8" style={{ color: "var(--tt-text-muted)" }}>Track your social media performance across all platforms.</p>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Reach", value: "24.5K", change: "+18%", icon: "👁" },
          { label: "Total Engagement", value: "3.2K", change: "+23%", icon: "❤️" },
          { label: "Posts Published", value: "113", change: "+12%", icon: "📝" },
          { label: "Avg. Engagement Rate", value: "4.6%", change: "+0.8%", icon: "📊" },
        ].map((s, i) => (
          <div key={i} className="p-5 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="text-xl mb-2">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{s.label}</span>
              <span className="text-xs" style={{ color: "#10b981" }}>{s.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly Chart */}
      <div className="p-6 rounded-2xl mb-8" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        <h3 className="font-semibold mb-6">Weekly Engagement</h3>
        <div className="flex items-end gap-3 h-48">
          {weeklyData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs font-medium">{d.engagement}</span>
              <div className="w-full rounded-t-lg transition-all" style={{
                height: `${(d.engagement / maxEngagement) * 100}%`,
                background: `linear-gradient(180deg, #6366f1, #a855f7)`,
                opacity: 0.8 + (d.engagement / maxEngagement) * 0.2,
              }}></div>
              <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        <h3 className="font-semibold mb-6">Platform Performance</h3>
        <div className="space-y-4">
          {platformData.map((p, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
              <div className="w-3 h-3 rounded-full" style={{ background: p.color }}></div>
              <div className="flex-1">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{p.followers} followers</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{p.engagement} rate</div>
                <div className="text-xs" style={{ color: "#10b981" }}>{p.growth}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{p.posts}</div>
                <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>posts</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
