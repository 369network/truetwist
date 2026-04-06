"use client";
import { useState } from "react";
import Link from "next/link";

/* ─── CALENDAR PAGE: Month/Week/Day with AI Auto-Scheduling ─── */

const PLATFORM_COLORS = {
  instagram: "#E4405F",
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  tiktok: "#ff0050",
};

const PLATFORMS = Object.entries(PLATFORM_COLORS).map(([key, color]) => ({
  id: key,
  name: key.charAt(0).toUpperCase() + key.slice(1),
  color,
}));

const HOURS = Array.from({ length: 18 }, (_, i) => 6 + i);

interface Event {
  id: string;
  day: number;
  title: string;
  platform: keyof typeof PLATFORM_COLORS;
  time: string;
  content?: string;
  isAIRecommended?: boolean;
}

const mockEvents: Event[] = [
  { id: "1", day: 2, title: "Product launch post", platform: "instagram", time: "09:00" },
  { id: "2", day: 4, title: "AI tips thread", platform: "twitter", time: "12:00", isAIRecommended: true },
  { id: "3", day: 5, title: "Weekly tips thread", platform: "twitter", time: "10:00" },
  { id: "4", day: 7, title: "Company culture", platform: "linkedin", time: "08:30" },
  { id: "5", day: 8, title: "Behind the scenes", platform: "tiktok", time: "18:00" },
  { id: "6", day: 10, title: "Tutorial carousel", platform: "instagram", time: "14:00", isAIRecommended: true },
  { id: "7", day: 12, title: "Case study share", platform: "linkedin", time: "09:00" },
  { id: "8", day: 14, title: "Meme Monday", platform: "twitter", time: "11:00" },
  { id: "9", day: 15, title: "Growth hack tips", platform: "instagram", time: "16:00" },
  { id: "10", day: 18, title: "User testimonial", platform: "facebook", time: "10:00" },
  { id: "11", day: 20, title: "Industry news", platform: "linkedin", time: "08:00" },
  { id: "12", day: 22, title: "AI trends post", platform: "twitter", time: "13:00", isAIRecommended: true },
  { id: "13", day: 24, title: "BTS Reel", platform: "tiktok", time: "19:00" },
  { id: "14", day: 25, title: "Monthly recap", platform: "instagram", time: "10:00" },
  { id: "15", day: 28, title: "FAQ post", platform: "facebook", time: "12:00" },
];

const aiSuggestions = {
  instagram: { time: "15:00", score: 92 },
  twitter: { time: "11:00", score: 88 },
  facebook: { time: "13:00", score: 85 },
  linkedin: { time: "09:00", score: 90 },
  tiktok: { time: "18:00", score: 87 },
};

const views = ["Month", "Week", "Day"] as const;
type ViewType = typeof views[number];

export default function CalendarPage() {
  const [view, setView] = useState<ViewType>("Month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [events, setEvents] = useState<Event[]>(mockEvents);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddData, setQuickAddData] = useState({ day: 1, hour: 9 });
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<Event | null>(null);

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

  const getEventsForDay = (day: number) => events.filter((e) => e.day === day);
  const scheduledCount = events.length;
  const aiRecommendedCount = events.filter((e) => e.isAIRecommended).length;
  const publishedCount = 0;
  const queueCount = 5;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today.getDate());
  };

  const handleQuickAdd = (day: number, hour: number) => {
    setQuickAddData({ day, hour });
    setShowQuickAdd(true);
  };

  const handleSaveEvent = (title: string, platforms: string[], content: string, useAI: boolean) => {
    const newEvent: Event = {
      id: Math.random().toString(36).substr(2, 9),
      day: quickAddData.day,
      title,
      platform: (platforms[0] || "instagram") as keyof typeof PLATFORM_COLORS,
      time: `${String(quickAddData.hour).padStart(2, "0")}:00`,
      content,
      isAIRecommended: useAI,
    };
    setEvents([...events, newEvent]);
    setShowQuickAdd(false);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter((e) => e.id !== id));
    setShowEventDetail(false);
  };

  const handleRescheduleEvent = (newDay: number, newHour: number) => {
    if (!selectedEvent) return;
    setEvents(
      events.map((e) =>
        e.id === selectedEvent.id
          ? { ...e, day: newDay, time: `${String(newHour).padStart(2, "0")}:00` }
          : e
      )
    );
    setSelectedEvent(null);
    setShowEventDetail(false);
  };

  const handleDragStart = (event: Event) => {
    setDraggedEvent(event);
  };

  const handleDrop = (day: number) => {
    if (!draggedEvent) return;
    setEvents(events.map((e) => (e.id === draggedEvent.id ? { ...e, day } : e)));
    setDraggedEvent(null);
  };

  // ─── MONTH VIEW ───
  const MonthView = () => (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
      <div className="grid grid-cols-7">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="p-3 text-center text-xs font-semibold"
            style={{ color: "var(--tt-text-muted)", borderBottom: "1px solid var(--tt-border)", background: "var(--tt-surface-2)" }}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div
            key={`e-${i}`}
            className="p-2 min-h-[110px]"
            style={{ borderBottom: "1px solid var(--tt-border)", borderRight: "1px solid var(--tt-border)", background: "rgba(0,0,0,0.1)" }}
          />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayEvents = getEventsForDay(day);
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <div
              key={day}
              className="p-2 min-h-[110px] transition-colors hover:bg-white/[0.02] cursor-pointer"
              style={{
                borderBottom: "1px solid var(--tt-border)",
                borderRight: "1px solid var(--tt-border)",
                background: isToday ? "rgba(99,102,241,0.06)" : "transparent",
              }}
              onClick={() => handleQuickAdd(day, 9)}
              onDrop={() => handleDrop(day)}
              onDragOver={(e) => e.preventDefault()}
            >
              <div
                className={`text-xs font-medium mb-1.5 ${isToday ? "w-6 h-6 rounded-full flex items-center justify-center text-white" : ""}`}
                style={isToday ? { background: "#6366f1" } : { color: "var(--tt-text-muted)" }}
              >
                {day}
              </div>
              {dayEvents.map((event) => (
                <div
                  key={event.id}
                  draggable
                  onDragStart={() => handleDragStart(event)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEvent(event);
                    setShowEventDetail(true);
                  }}
                  className="text-xs p-1.5 rounded-md mb-1 truncate cursor-pointer transition hover:opacity-80"
                  style={{
                    background: PLATFORM_COLORS[event.platform] + "18",
                    color: PLATFORM_COLORS[event.platform],
                    borderLeft: `2px solid ${PLATFORM_COLORS[event.platform]}`,
                    opacity: draggedEvent?.id === event.id ? 0.5 : 1,
                    boxShadow: event.isAIRecommended ? `0 0 8px ${PLATFORM_COLORS[event.platform]}40` : "none",
                  }}
                  title={`${event.title} (${event.time})`}
                >
                  {event.isAIRecommended && <span style={{ marginRight: "4px" }}>✨</span>}
                  <span className="opacity-60">{event.time}</span> {event.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── WEEK VIEW ───
  const WeekView = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekDays = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000));

    return (
      <div className="overflow-x-auto rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        <div className="grid gap-0" style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}>
          <div className="p-2 font-semibold text-xs" style={{ color: "var(--tt-text-muted)" }} />
          {weekDays.map((d, i) => {
            const dayName = d.toLocaleString("default", { weekday: "short" });
            const dayNum = d.getDate();
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div
                key={i}
                className="p-2 text-center text-xs font-semibold"
                style={{
                  color: isToday ? "#6366f1" : "var(--tt-text-muted)",
                  background: isToday ? "rgba(99,102,241,0.1)" : "var(--tt-surface-2)",
                  borderBottom: "1px solid var(--tt-border)",
                }}
              >
                {dayName} {dayNum}
              </div>
            );
          })}

          {HOURS.map((hour) => (
            <div key={`h-${hour}`}>
              <div
                className="p-2 text-xs text-right pr-1 h-16"
                style={{
                  color: "var(--tt-text-muted)",
                  borderRight: "1px solid var(--tt-border)",
                  background: "var(--tt-surface-2)",
                }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            </div>
          ))}

          {weekDays.map((d, dayIdx) => {
            const dayNum = d.getDate();
            const dayEvents = getEventsForDay(dayNum);
            const isToday = d.toDateString() === today.toDateString();

            return HOURS.map((hour) => {
              const cellKey = `${dayIdx}-${hour}`;
              const hourEvents = dayEvents.filter((e) => parseInt(e.time) === hour);
              const isAIOptimal = aiSuggestions[dayEvents[0]?.platform]?.time === `${String(hour).padStart(2, "0")}:00`;

              return (
                <div
                  key={cellKey}
                  className="h-16 p-1 border border-transparent hover:border cursor-pointer transition"
                  style={{
                    borderColor: "var(--tt-border)",
                    background: isAIOptimal ? "rgba(99,102,241,0.08)" : isToday ? "rgba(99,102,241,0.03)" : "transparent",
                    backgroundImage: isAIOptimal ? "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(99,102,241,0.1) 10px, rgba(99,102,241,0.1) 20px)" : "none",
                  }}
                  onClick={() => handleQuickAdd(dayNum, hour)}
                >
                  {hourEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                        setShowEventDetail(true);
                      }}
                      className="text-xs p-1 rounded mb-0.5 truncate cursor-pointer"
                      style={{
                        background: PLATFORM_COLORS[event.platform],
                        color: "white",
                        boxShadow: event.isAIRecommended ? `0 0 8px ${PLATFORM_COLORS[event.platform]}60` : "none",
                      }}
                      title={event.title}
                    >
                      {event.isAIRecommended && "✨ "}
                      {event.title}
                    </div>
                  ))}
                </div>
              );
            });
          })}
        </div>
      </div>
    );
  };

  // ─── DAY VIEW ───
  const DayView = () => {
    const dayEvents = getEventsForDay(selectedDay).sort((a, b) => a.time.localeCompare(b.time));
    const dayDate = new Date(year, month, selectedDay);
    const dayName = dayDate.toLocaleString("default", { weekday: "long", month: "long", day: "numeric" });

    return (
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-2xl overflow-hidden" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <div className="p-4 border-b" style={{ borderColor: "var(--tt-border)", background: "var(--tt-surface-2)" }}>
            <h2 className="font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              {dayName}
            </h2>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "600px" }}>
            {HOURS.map((hour) => {
              const hourEvents = dayEvents.filter((e) => parseInt(e.time) === hour);
              return (
                <div key={`day-${hour}`} className="flex border-b" style={{ borderColor: "var(--tt-border)" }}>
                  <div
                    className="w-20 p-3 text-xs text-right"
                    style={{ color: "var(--tt-text-muted)", background: "var(--tt-surface-2)", borderRight: "1px solid var(--tt-border)" }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  <div className="flex-1 p-3 flex flex-col gap-2">
                    {hourEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowEventDetail(true);
                        }}
                        className="p-2 rounded cursor-pointer transition hover:opacity-80"
                        style={{
                          background: PLATFORM_COLORS[event.platform] + "20",
                          borderLeft: `3px solid ${PLATFORM_COLORS[event.platform]}`,
                          color: PLATFORM_COLORS[event.platform],
                        }}
                      >
                        <div className="text-xs font-semibold flex items-center gap-1">
                          {event.isAIRecommended && <span>✨</span>}
                          {event.title}
                        </div>
                        <div className="text-xs opacity-60 mt-1">{event.platform}</div>
                      </div>
                    ))}
                    {hourEvents.length === 0 && (
                      <button
                        onClick={() => handleQuickAdd(selectedDay, hour)}
                        className="text-xs py-1 px-2 rounded opacity-40 hover:opacity-60 transition"
                        style={{ color: "var(--tt-text-muted)" }}
                      >
                        + Add event
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Suggestions Panel */}
        <div className="rounded-2xl p-4 h-fit" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
            AI Suggestions
          </h3>
          {PLATFORMS.map((p) => {
            const suggestion = aiSuggestions[p.id as keyof typeof aiSuggestions];
            return (
              <div key={p.id} className="mb-3 p-2 rounded-lg" style={{ background: "var(--tt-surface-2)", borderLeft: `3px solid ${p.color}` }}>
                <div className="text-xs font-medium" style={{ color: p.color }}>
                  {p.name}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--tt-text-muted)" }}>
                  {suggestion.time}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <div
                    className="flex-1 h-1.5 rounded-full"
                    style={{
                      background: "var(--tt-border)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${suggestion.score}%`,
                        height: "100%",
                        background: p.color,
                      }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: p.color }}>
                    {suggestion.score}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            Content Calendar
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>
            {monthName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-2" style={{ borderRight: "1px solid var(--tt-border)", paddingRight: "12px" }}>
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg transition hover:bg-white/[0.05]"
              style={{ color: "var(--tt-text-muted)" }}
            >
              ←
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-2 text-xs font-medium rounded-lg transition"
              style={{
                background: "rgba(99,102,241,0.1)",
                color: "#a5b4fc",
              }}
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg transition hover:bg-white/[0.05]"
              style={{ color: "var(--tt-text-muted)" }}
            >
              →
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--tt-border)" }}>
            {views.map((v) => (
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
          { label: "Scheduled", value: scheduledCount.toString(), color: "#6366f1" },
          { label: "Published", value: publishedCount.toString(), color: "#10b981" },
          { label: "AI-Recommended", value: aiRecommendedCount.toString(), color: "#a855f7" },
          { label: "Queue", value: queueCount.toString(), color: "#f59e0b" },
        ].map((s, i) => (
          <div key={i} className="p-3 rounded-xl text-center" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="text-lg font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Calendar Content */}
      {view === "Month" && <MonthView />}
      {view === "Week" && <WeekView />}
      {view === "Day" && (
        <div>
          <div className="mb-4 flex gap-2 overflow-x-auto">
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = day === selectedDay;
              const isToday = isCurrentMonth && day === today.getDate();
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap"
                  style={{
                    background: isSelected ? "rgba(99,102,241,0.2)" : isToday ? "rgba(99,102,241,0.05)" : "var(--tt-surface)",
                    color: isSelected ? "#a5b4fc" : isToday ? "#6366f1" : "var(--tt-text-muted)",
                    border: `1px solid ${isSelected ? "rgba(99,102,241,0.5)" : "var(--tt-border)"}`,
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <DayView />
        </div>
      )}

      {/* Platform Legend */}
      <div className="flex items-center gap-4 mt-6 flex-wrap">
        {PLATFORMS.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
              {p.name}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span style={{ marginRight: "4px" }}>✨</span>
          <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
            AI-Recommended
          </span>
        </div>
      </div>

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <QuickAddModal
          onClose={() => setShowQuickAdd(false)}
          onSave={handleSaveEvent}
          day={quickAddData.day}
          hour={quickAddData.hour}
        />
      )}

      {/* Event Detail Modal */}
      {showEventDetail && selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setShowEventDetail(false)}
          onDelete={handleDeleteEvent}
          onReschedule={handleRescheduleEvent}
        />
      )}
    </div>
  );
}

// ─── QUICK ADD MODAL ───
interface QuickAddModalProps {
  onClose: () => void;
  onSave: (title: string, platforms: string[], content: string, useAI: boolean) => void;
  day: number;
  hour: number;
}

function QuickAddModal({ onClose, onSave, day, hour }: QuickAddModalProps) {
  const [title, setTitle] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram"]);
  const [content, setContent] = useState("");
  const [useAI, setUseAI] = useState(false);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(title, selectedPlatforms, content, useAI);
    setTitle("");
    setSelectedPlatforms(["instagram"]);
    setContent("");
    setUseAI(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      style={{ backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-black rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Schedule New Post
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--tt-text-muted)" }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title..."
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--tt-text-muted)" }}>
              Platforms
            </label>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    setSelectedPlatforms(
                      selectedPlatforms.includes(p.id) ? selectedPlatforms.filter((x) => x !== p.id) : [...selectedPlatforms, p.id]
                    )
                  }
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                  style={{
                    background: selectedPlatforms.includes(p.id) ? p.color + "30" : "var(--tt-surface-2)",
                    color: selectedPlatforms.includes(p.id) ? p.color : "var(--tt-text-muted)",
                    border: `1px solid ${selectedPlatforms.includes(p.id) ? p.color : "var(--tt-border)"}`,
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--tt-text-muted)" }}>
              Date & Time: {day} at {String(hour).padStart(2, "0")}:00
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
                Let AI pick best time
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--tt-text-muted)" }}>
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Post content..."
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              rows={4}
              style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition"
              style={{
                background: "var(--tt-surface-2)",
                color: "var(--tt-text-muted)",
                border: "1px solid var(--tt-border)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
              style={{ background: "#6366f1" }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EVENT DETAIL MODAL ───
interface EventDetailModalProps {
  event: Event;
  onClose: () => void;
  onDelete: (id: string) => void;
  onReschedule: (day: number, hour: number) => void;
}

function EventDetailModal({ event, onClose, onDelete, onReschedule }: EventDetailModalProps) {
  const [rescheduleDay, setRescheduleDay] = useState(event.day);
  const [rescheduleHour, setRescheduleHour] = useState(parseInt(event.time));

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      style={{ backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-black rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          {event.title}
        </h2>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--tt-surface-2)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: PLATFORM_COLORS[event.platform] }} />
            <div>
              <div className="text-xs font-medium">{event.platform}</div>
              <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
                {event.day} at {event.time}
              </div>
            </div>
          </div>

          {event.content && (
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "var(--tt-text-muted)" }}>
                Content
              </label>
              <div className="p-3 rounded-lg text-xs" style={{ background: "var(--tt-surface-2)" }}>
                {event.content}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--tt-text-muted)" }}>
              Reschedule
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="31"
                value={rescheduleDay}
                onChange={(e) => setRescheduleDay(parseInt(e.target.value))}
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}
              />
              <input
                type="number"
                min="0"
                max="23"
                value={rescheduleHour}
                onChange={(e) => setRescheduleHour(parseInt(e.target.value))}
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => onDelete(event.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition"
              style={{
                background: "rgba(239,68,68,0.1)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.3)",
              }}
            >
              Delete
            </button>
            <button
              onClick={() => onReschedule(rescheduleDay, rescheduleHour)}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition"
              style={{ background: "#6366f1" }}
            >
              Reschedule
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition"
              style={{
                background: "var(--tt-surface-2)",
                color: "var(--tt-text-muted)",
                border: "1px solid var(--tt-border)",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
