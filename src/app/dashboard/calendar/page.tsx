"use client";
import { useState } from "react";
import Link from "next/link";

/* ─── TRUA-22/24: Content Calendar with Month/Week/Day toggle ─── */

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const mockEvents = [
  { day: 2, title: "Product launch post", platform: "instagram", color: "#E4405F", time: "09:00", type: "post" },
  { day: 4, title: "AI tips thread", platform: "twitter", color: "#1DA1F2", time: "12:00", type: "thread" },
  { day: 5, title: "Weekly tips thread", platform: "twitter", color: "#1DA1F2", time: "10:00", type: "thread" },
  { day: 7, title: "Company culture", platform: "linkedin", color: "#0A66C2", time: "08:30", type: "post" },
  { day: 8, title: "Behind the scenes", platform: "tiktok", color: "#ff0050", time: "18:00", type: "video" },
  { day: 10, title: "Tutorial carousel", platform: "instagram", color: "#E4405F", time: "14:00", type: "carousel" },
  { day: 12, title: "Case study share", platform: "linkedin", color: "#0A66C2", time: "09:00", type: "post" },
  { day: 14, title: "Meme Monday", platform: "twitter", color: "#1DA1F2", time: "11:00", type: "post" },
  { day: 15, title: "Growth hack tips", platform: "instagram", color: "#E4405F", time: "16:00", type: "carousel" },
  { day: 18, title: "User testimonial", platform: "facebook", color: "#1877F2", time: "10:00", type: "video" },
  { day: 20, title: "Industry news", platform: "linkedin", color: "#0A66C2", time: "08:00", type: "post" },
  { day: 22, title: "AI trends post", platform: "twitter", color: "#1DA1F2", time: "13:00", type: "thread" },
  { day: 24, title: "BTS Reel", platform: "tiktok", color: "#ff0050", time: "19:00", type: "video" },
  { day: 25, title: "Monthly recap", platform: "instagram", color: "#E4405F", time: "10:00", type: "carousel" },
  { day: 28, title: "FAQ post", platform: "facebook", color: "#1877F2", time: "12:00", type: "post" },
];

const views = ["Month", "Week", "Day"] as const;
type ViewType = typeof views[number];

export default function CalendarPage() {
  const [view, setView] = useState<ViewType>("Month");
  const [month] = useState(new Date().getMonth());
  const [year] = useState(new Date().getFullYear());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthName = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });
  const today = new Date().getDate();

  const getEventsForDay = (day: number) => mockEvents.filter(e => e.day === day);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Content Calendar</h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>{monthName}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--tt-border)" }}>
            {views.map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-medium transition"
                style={{
                  background: view === v ? "rgba(99,102,241,0.2)" : "var(--tt-surface)",
                  color: view === v ? "#a5b4fc" : "var(--tt-text-muted)",
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <Link href="/dashboard/generate" className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Post
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Scheduled", value: mockEvents.length.toString(), color: "#6366f1" },
          { label: "Published", value: "0", color: "#10b981" },
          { label: "Drafts", value: "3", color: "#f59e0b" },
          { label: "Failed", value: "0", color: "#ef4444" },
        ].map((s, i) => (
          <div key={i} className="p-3 rounded-xl text-center" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        {/* Day Headers */}
        <div className="grid grid-cols-7">
          {days.map(d => (
            <div
              key={d}
              className="p-3 text-center text-xs font-semibold"
              style={{ color: "var(--tt-text-muted)", borderBottom: "1px solid var(--tt-border)", background: "var(--tt-surface-2)" }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Empty cells + Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} className="p-2 min-h-[110px]" style={{ borderBottom: "1px solid var(--tt-border)", borderRight: "1px solid var(--tt-border)", background: "rgba(0,0,0,0.1)" }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const events = getEventsForDay(day);
            const isToday = day === today && month === new Date().getMonth();
            return (
              <div
                key={day}
                className="p-2 min-h-[110px] transition-colors hover:bg-white/[0.02]"
                style={{
                  borderBottom: "1px solid var(--tt-border)",
                  borderRight: "1px solid var(--tt-border)",
                  background: isToday ? "rgba(99,102,241,0.06)" : "transparent",
                }}
              >
                <div className={`text-xs font-medium mb-1.5 ${isToday ? "w-6 h-6 rounded-full flex items-center justify-center text-white" : ""}`}
                  style={isToday ? { background: "#6366f1" } : { color: "var(--tt-text-muted)" }}
                >
                  {day}
                </div>
                {events.map((event, j) => (
                  <div
                    key={j}
                    className="text-xs p-1.5 rounded-md mb-1 truncate cursor-pointer transition hover:opacity-80"
                    style={{
                      background: event.color + "18",
                      color: event.color,
                      borderLeft: `2px solid ${event.color}`,
                    }}
                    title={`${event.title} (${event.time})`}
                  >
                    <span className="opacity-60 mr-1">{event.time}</span>
                    {event.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Platform Legend */}
      <div className="flex items-center gap-4 mt-4 flex-wrap">
        {[
          { name: "Instagram", color: "#E4405F" },
          { name: "X (Twitter)", color: "#1DA1F2" },
          { name: "LinkedIn", color: "#0A66C2" },
          { name: "TikTok", color: "#ff0050" },
          { name: "Facebook", color: "#1877F2" },
        ].map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
