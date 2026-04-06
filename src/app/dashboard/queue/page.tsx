"use client";
import { useState, useMemo } from "react";
import Link from "next/link";

/* ─── Content Queue Page ─── */

const platformColors: Record<string, string> = {
  instagram: "#E4405F",
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  tiktok: "#ff0050",
};

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  twitter: "Twitter/X",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

const mockQueueItems = [
  {
    id: "1",
    content: "Just launched our new AI-powered content generator! It's a game-changer for social media teams. Check out what we built...",
    platform: "instagram",
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    status: "queued",
    ai_recommended: true,
    ai_reason: "High engagement expected based on similar content at this time",
    postType: "carousel",
  },
  {
    id: "2",
    content: "Thread: 10 tips for optimizing your social media strategy in 2026... 🧵",
    platform: "twitter",
    scheduledAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
    status: "queued",
    ai_recommended: true,
    ai_reason: "Optimal posting time for tech audience",
    postType: "thread",
  },
  {
    id: "3",
    content: "Behind the scenes at our office: Meet the team that makes TrueTwist amazing! 🎬",
    platform: "tiktok",
    scheduledAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours from now
    status: "queued",
    ai_recommended: false,
    ai_reason: null,
    postType: "video",
  },
  {
    id: "4",
    content: "Excited to announce our partnership with leading brands in the social media space!",
    platform: "linkedin",
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
    status: "queued",
    ai_recommended: true,
    ai_reason: "Perfect for business professionals on Tuesday morning",
    postType: "post",
  },
  {
    id: "5",
    content: "Check out our latest blog post on social media trends for 2026",
    platform: "facebook",
    scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // in 2 days
    status: "publishing",
    ai_recommended: false,
    ai_reason: null,
    postType: "post",
  },
  {
    id: "6",
    content: "Success story: How our client increased engagement by 300% in 3 months",
    platform: "instagram",
    scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    status: "published",
    ai_recommended: true,
    ai_reason: "Performed 45% above average",
    postType: "carousel",
  },
  {
    id: "7",
    content: "Server maintenance scheduled for this weekend. Plan accordingly!",
    platform: "twitter",
    scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
    status: "failed",
    ai_recommended: false,
    ai_reason: null,
    postType: "post",
  },
];

type Status = "all" | "queued" | "publishing" | "published" | "failed" | "cancelled";
type Platform = "all" | "instagram" | "twitter" | "facebook" | "linkedin" | "tiktok";

export default function QueuePage() {
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [platformFilter, setPlatformFilter] = useState<Platform>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");

  const filteredItems = useMemo(() => {
    return mockQueueItems.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;

      const scheduleDate = new Date(item.scheduledAt);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (dateRange === "today") {
        const scheduleDay = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth(), scheduleDate.getDate());
        if (scheduleDay.getTime() !== todayStart.getTime()) return false;
      } else if (dateRange === "week") {
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        if (scheduleDate < weekStart || scheduleDate >= weekEnd) return false;
      } else if (dateRange === "month") {
        if (scheduleDate.getMonth() !== now.getMonth() || scheduleDate.getFullYear() !== now.getFullYear()) return false;
      }

      return true;
    });
  }, [statusFilter, platformFilter, dateRange]);

  const queuedCount = mockQueueItems.filter((i) => i.status === "queued").length;
  const publishedCount = mockQueueItems.filter((i) => i.status === "published").length;
  const failedCount = mockQueueItems.filter((i) => i.status === "failed").length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "queued":
        return "#6366f1";
      case "publishing":
        return "#f59e0b";
      case "published":
        return "#10b981";
      case "failed":
        return "#ef4444";
      case "cancelled":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));

    if (diffHours < 0) {
      const absDiffHours = Math.abs(diffHours);
      if (absDiffHours < 24) return `${absDiffHours}h ago`;
      return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    if (diffHours < 24) return `in ${diffHours}h`;
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // AI Optimal Times Heatmap Mock Data
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = [6, 9, 12, 15, 18, 21];

  const getOptimalTimeScore = (day: number, hour: number, platform: string) => {
    const baseScore = Math.sin((day + hour) / 7) * 0.5 + 0.5;
    const platformBonus = platform === "instagram" ? 0.2 : platform === "twitter" ? 0.15 : 0;
    return Math.min(1, baseScore + platformBonus);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Content Queue</h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>
            {queuedCount} queued, {publishedCount} published, {failedCount} failed
          </p>
        </div>
        <button
          className="px-4 py-2 rounded-xl text-sm font-medium transition"
          style={{
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            color: "white",
          }}
        >
          Auto-Schedule
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Queued", value: queuedCount.toString(), color: "#6366f1" },
          { label: "Publishing", value: "1", color: "#f59e0b" },
          { label: "Published", value: publishedCount.toString(), color: "#10b981" },
          { label: "Failed", value: failedCount.toString(), color: "#ef4444" },
        ].map((s, i) => (
          <div key={i} className="p-3 rounded-xl text-center" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="text-lg font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue List (2/3 width) */}
        <div className="lg:col-span-2">
          {/* Filter Bar */}
          <div className="mb-6 flex flex-wrap gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
              <span className="text-xs font-medium" style={{ color: "var(--tt-text-muted)" }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as Status)}
                className="bg-transparent text-sm outline-none"
                style={{ color: "var(--tt-text)" }}
              >
                <option value="all">All</option>
                <option value="queued">Queued</option>
                <option value="publishing">Publishing</option>
                <option value="published">Published</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Platform Filter */}
            <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
              <span className="text-xs font-medium" style={{ color: "var(--tt-text-muted)" }}>Platform:</span>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value as Platform)}
                className="bg-transparent text-sm outline-none"
                style={{ color: "var(--tt-text)" }}
              >
                <option value="all">All Platforms</option>
                <option value="instagram">Instagram</option>
                <option value="twitter">Twitter/X</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
              <span className="text-xs font-medium" style={{ color: "var(--tt-text-muted)" }}>Date:</span>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="bg-transparent text-sm outline-none"
                style={{ color: "var(--tt-text)" }}
              >
                <option value="all">All</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </div>

          {/* Queue Items */}
          {filteredItems.length === 0 ? (
            <div className="p-12 rounded-2xl text-center" style={{ background: "var(--tt-surface)", border: "1px dashed var(--tt-border)" }}>
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: "var(--tt-text-muted)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.125 1.125 0 010 2.25H5.625a1.125 1.125 0 010-2.25z" />
              </svg>
              <h3 className="text-lg font-semibold mb-2">Queue is empty</h3>
              <p className="text-sm mb-4" style={{ color: "var(--tt-text-muted)" }}>Create content and schedule it to your queue</p>
              <Link href="/dashboard/generate" className="inline-block px-4 py-2 rounded-xl text-sm font-medium transition" style={{ background: "rgba(99,102,241,0.1)", color: "#a5b4fc" }}>
                Create Content
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Select All */}
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "var(--tt-surface-2)" }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                />
                <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
                </span>
              </div>

              {/* Queue Items */}
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl transition hover:scale-102"
                  style={{
                    background: "var(--tt-surface)",
                    border: "1px solid var(--tt-border)",
                    cursor: "pointer",
                  }}
                >
                  <div className="flex gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="cursor-pointer mt-1"
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <p className="text-sm line-clamp-2 mb-2">{item.content}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Platform Badge */}
                            <span
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-white"
                              style={{ background: platformColors[item.platform] }}
                            >
                              {platformLabels[item.platform]}
                            </span>

                            {/* AI Recommendation Badge */}
                            {item.ai_recommended && (
                              <span
                                className="px-2.5 py-1 rounded-lg text-xs font-medium text-white group relative cursor-help"
                                style={{ background: "#8b5cf6" }}
                                title={item.ai_reason || ""}
                              >
                                ✨ AI Recommended
                              </span>
                            )}

                            {/* Status */}
                            <span
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-white capitalize"
                              style={{ background: getStatusColor(item.status) }}
                            >
                              {item.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Scheduled Time */}
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
                          {formatDate(item.scheduledAt)}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                            style={{
                              background: "rgba(99,102,241,0.1)",
                              color: "#a5b4fc",
                            }}
                          >
                            Reschedule
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                            style={{
                              background: "rgba(239,68,68,0.1)",
                              color: "#fca5a5",
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                            style={{
                              background: "rgba(34,197,94,0.1)",
                              color: "#86efac",
                            }}
                          >
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Optimal Times Panel (1/3 width) */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl p-6" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
              AI Optimal Times
            </h2>

            {/* Heatmap Legend */}
            <div className="mb-6 pb-4" style={{ borderBottom: "1px solid var(--tt-border)" }}>
              <p className="text-xs mb-3" style={{ color: "var(--tt-text-muted)" }}>Best posting times by platform</p>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded" style={{ background: "rgba(99,102,241,0.2)" }} />
                <span style={{ color: "var(--tt-text-muted)" }}>Low</span>
                <div className="flex-1 h-2 rounded" style={{ background: "linear-gradient(90deg, rgba(99,102,241,0.2), #6366f1)" }} />
                <span style={{ color: "var(--tt-text-muted)" }}>High</span>
              </div>
            </div>

            {/* Heatmap - Instagram */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: platformColors.instagram }} />
                Instagram
              </h3>
              <div className="space-y-2">
                {daysOfWeek.map((day, dayIdx) => (
                  <div key={day} className="flex items-center gap-2">
                    <span className="text-xs w-8" style={{ color: "var(--tt-text-muted)" }}>
                      {day}
                    </span>
                    <div className="flex gap-1 flex-1">
                      {hours.map((hour) => {
                        const score = getOptimalTimeScore(dayIdx, hour, "instagram");
                        return (
                          <div
                            key={`${day}-${hour}`}
                            className="h-6 rounded-sm flex-1 cursor-help"
                            style={{
                              background: `rgba(99,102,241,${score})`,
                            }}
                            title={`${day} ${hour}:00 - ${(score * 100).toFixed(0)}% optimal`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap - Twitter */}
            <div>
              <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: platformColors.twitter }} />
                Twitter/X
              </h3>
              <div className="space-y-2">
                {daysOfWeek.map((day, dayIdx) => (
                  <div key={day} className="flex items-center gap-2">
                    <span className="text-xs w-8" style={{ color: "var(--tt-text-muted)" }}>
                      {day}
                    </span>
                    <div className="flex gap-1 flex-1">
                      {hours.map((hour) => {
                        const score = getOptimalTimeScore(dayIdx, hour, "twitter");
                        return (
                          <div
                            key={`${day}-${hour}`}
                            className="h-6 rounded-sm flex-1 cursor-help"
                            style={{
                              background: `rgba(29,161,242,${score})`,
                            }}
                            title={`${day} ${hour}:00 - ${(score * 100).toFixed(0)}% optimal`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
