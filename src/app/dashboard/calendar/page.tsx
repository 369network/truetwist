"use client";
import { useState } from "react";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const mockEvents = [
  { day: 2, title: "Product launch post", platform: "instagram", color: "#e91e63" },
  { day: 5, title: "Weekly tips thread", platform: "twitter", color: "#1da1f2" },
  { day: 8, title: "Behind the scenes", platform: "tiktok", color: "#00f2ea" },
  { day: 12, title: "Case study share", platform: "linkedin", color: "#0077b5" },
  { day: 15, title: "Growth hack tips", platform: "instagram", color: "#e91e63" },
  { day: 18, title: "User testimonial", platform: "facebook", color: "#1877f2" },
  { day: 22, title: "AI trends post", platform: "twitter", color: "#1da1f2" },
  { day: 25, title: "Monthly recap", platform: "instagram", color: "#e91e63" },
];

export default function CalendarPage() {
  const [month] = useState(new Date().getMonth());
  const [year] = useState(new Date().getFullYear());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthName = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>{monthName}</p>
        </div>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        <div className="grid grid-cols-7">
          {days.map(d => (
            <div key={d} className="p-3 text-center text-xs font-medium" style={{ color: "var(--tt-text-muted)", borderBottom: "1px solid var(--tt-border)" }}>{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} className="p-3 min-h-[100px]" style={{ borderBottom: "1px solid var(--tt-border)", borderRight: "1px solid var(--tt-border)" }}></div>
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const event = mockEvents.find(e => e.day === day);
            const isToday = day === new Date().getDate() && month === new Date().getMonth();
            return (
              <div key={day} className="p-2 min-h-[100px]" style={{ borderBottom: "1px solid var(--tt-border)", borderRight: "1px solid var(--tt-border)", background: isToday ? "rgba(99,102,241,0.05)" : "transparent" }}>
                <div className={`text-xs font-medium mb-1 ${isToday ? "w-6 h-6 rounded-full flex items-center justify-center text-white" : ""}`} style={isToday ? { background: "#6366f1" } : { color: "var(--tt-text-muted)" }}>
                  {day}
                </div>
                {event && (
                  <div className="text-xs p-1.5 rounded-md mt-1 truncate" style={{ background: event.color + "20", color: event.color, borderLeft: `2px solid ${event.color}` }}>
                    {event.title}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
