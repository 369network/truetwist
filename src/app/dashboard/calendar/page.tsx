"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Camera,
  MessageCircle,
  ThumbsUp,
  Briefcase,
  Music,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  X,
} from "lucide-react";

/* ─── CALENDAR PAGE: Month/Week/Day with AI Auto-Scheduling ─── */

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  tiktok: "#ff0050",
};

const PLATFORM_ICONS: Record<string, typeof Camera> = {
  instagram: Camera,
  twitter: MessageCircle,
  facebook: ThumbsUp,
  linkedin: Briefcase,
  tiktok: Music,
};

const PLATFORMS = Object.entries(PLATFORM_COLORS).map(([key, color]) => ({
  id: key,
  name: key.charAt(0).toUpperCase() + key.slice(1),
  color,
  Icon: PLATFORM_ICONS[key],
}));

const HOURS = Array.from({ length: 18 }, (_, i) => 6 + i);

interface Event {
  id: string;
  day: number;
  title: string;
  platform: string;
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
type ViewType = (typeof views)[number];

function getPlatformIcon(platform: string) {
  return PLATFORM_ICONS[platform.toLowerCase()] || Camera;
}

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

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1));

  const handleToday = () => {
    const t = new Date();
    setCurrentDate(t);
    setSelectedDay(t.getDate());
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
      platform: platforms[0] || "instagram",
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

  const handleDragStart = (event: Event) => setDraggedEvent(event);

  const handleDrop = (day: number) => {
    if (!draggedEvent) return;
    setEvents(events.map((e) => (e.id === draggedEvent.id ? { ...e, day } : e)));
    setDraggedEvent(null);
  };

  // ─── EVENT CHIP ───
  const EventChip = ({ event, compact = false }: { event: Event; compact?: boolean }) => {
    const platformColor = PLATFORM_COLORS[event.platform] || "#6366f1";
    const PlatformIcon = getPlatformIcon(event.platform);

    return (
      <div
        draggable
        onDragStart={() => handleDragStart(event)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedEvent(event);
          setShowEventDetail(true);
        }}
        className="group flex items-center gap-1.5 text-[13px] leading-tight p-2 rounded-lg mb-1 cursor-pointer transition-all duration-200 hover:shadow-md"
        style={{
          background: platformColor + "14",
          borderLeft: `3px solid ${platformColor}`,
          opacity: draggedEvent?.id === event.id ? 0.5 : 1,
        }}
        title={`${event.title} (${event.time})`}
      >
        <PlatformIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: platformColor }} />
        <span className="truncate font-medium" style={{ color: platformColor }}>
          {event.title}
        </span>
        {event.isAIRecommended && (
          <Sparkles className="w-3 h-3 flex-shrink-0 text-purple-400" />
        )}
        {!compact && (
          <span className="ml-auto text-[11px] opacity-60 flex-shrink-0" style={{ color: platformColor }}>
            {event.time}
          </span>
        )}
      </div>
    );
  };

  // ─── MONTH VIEW ───
  const MonthView = () => (
    <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-card">
      <div className="grid grid-cols-7">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="p-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-muted border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface-2"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div
            key={`e-${i}`}
            className="p-3 min-h-[130px] bg-gray-50/50 dark:bg-dark-bg/30 border-b border-r border-gray-100 dark:border-dark-border/50"
          />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayEvents = getEventsForDay(day);
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <div
              key={day}
              className="p-3 min-h-[130px] transition-all duration-200 hover:bg-brand-50/30 dark:hover:bg-brand-900/10 cursor-pointer border-b border-r border-gray-100 dark:border-dark-border/50"
              style={{
                background: isToday ? "rgba(99,102,241,0.06)" : undefined,
              }}
              onClick={() => handleQuickAdd(day, 9)}
              onDrop={() => handleDrop(day)}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-sm font-semibold ${
                    isToday
                      ? "w-7 h-7 rounded-full flex items-center justify-center text-white bg-brand-500"
                      : "text-gray-700 dark:text-dark-muted"
                  }`}
                >
                  {day}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventChip key={event.id} event={event} compact />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[11px] font-medium text-brand-500 pl-1 pt-0.5">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
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
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-card">
        <div className="grid gap-0" style={{ gridTemplateColumns: "72px repeat(7, 1fr)" }}>
          <div className="p-2 bg-gray-50 dark:bg-dark-surface-2 border-b border-r border-gray-200 dark:border-dark-border" />
          {weekDays.map((d, i) => {
            const dayName = d.toLocaleString("default", { weekday: "short" });
            const dayNum = d.getDate();
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div
                key={i}
                className={`p-3 text-center border-b border-gray-200 dark:border-dark-border ${
                  isToday ? "bg-brand-50 dark:bg-brand-900/20" : "bg-gray-50 dark:bg-dark-surface-2"
                }`}
              >
                <div className={`text-xs font-medium ${isToday ? "text-brand-600 dark:text-brand-400" : "text-gray-500 dark:text-dark-muted"}`}>
                  {dayName}
                </div>
                <div
                  className={`text-lg font-bold mt-0.5 ${
                    isToday
                      ? "w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center mx-auto"
                      : "text-gray-700 dark:text-dark-text"
                  }`}
                >
                  {dayNum}
                </div>
              </div>
            );
          })}

          {HOURS.map((hour) => (
            <>
              <div
                key={`h-${hour}`}
                className="p-2 text-xs text-right pr-3 h-16 border-r border-b border-gray-100 dark:border-dark-border/50 bg-gray-50/50 dark:bg-dark-surface-2/50 text-gray-400 dark:text-dark-muted font-medium"
              >
                {String(hour).padStart(2, "0")}:00
              </div>
              {weekDays.map((d, dayIdx) => {
                const dayNum = d.getDate();
                const dayEvents = getEventsForDay(dayNum);
                const isToday = d.toDateString() === today.toDateString();
                const hourEvents = dayEvents.filter((e) => parseInt(e.time) === hour);

                return (
                  <div
                    key={`${dayIdx}-${hour}`}
                    className={`h-16 p-1 border-b border-r border-gray-100 dark:border-dark-border/50 cursor-pointer transition-all duration-200 hover:bg-brand-50/30 dark:hover:bg-brand-900/10 ${
                      isToday ? "bg-brand-50/20 dark:bg-brand-900/5" : ""
                    }`}
                    onClick={() => handleQuickAdd(dayNum, hour)}
                  >
                    {hourEvents.map((event) => {
                      const platformColor = PLATFORM_COLORS[event.platform] || "#6366f1";
                      const PlatformIcon = getPlatformIcon(event.platform);
                      return (
                        <div
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                            setShowEventDetail(true);
                          }}
                          className="flex items-center gap-1 text-xs p-1.5 rounded-lg mb-0.5 truncate cursor-pointer transition-all duration-200 hover:shadow-md text-white font-medium"
                          style={{ background: platformColor }}
                          title={event.title}
                        >
                          <PlatformIcon className="w-3 h-3 flex-shrink-0" />
                          {event.isAIRecommended && <Sparkles className="w-3 h-3 flex-shrink-0" />}
                          <span className="truncate">{event.title}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          ))}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-card">
          <div className="p-4 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface-2">
            <h2 className="font-semibold text-gray-900 dark:text-dark-text">{dayName}</h2>
            {dayEvents.length === 0 && (
              <p className="text-xs mt-1 text-gray-500 dark:text-dark-muted">No posts scheduled for this day</p>
            )}
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "600px" }}>
            {HOURS.map((hour) => {
              const hourEvents = dayEvents.filter((e) => parseInt(e.time) === hour);
              return (
                <div key={`day-${hour}`} className="flex border-b border-gray-100 dark:border-dark-border/50">
                  <div className="w-20 p-3 text-xs text-right font-medium text-gray-400 dark:text-dark-muted bg-gray-50/50 dark:bg-dark-surface-2/50 border-r border-gray-100 dark:border-dark-border/50">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  <div className="flex-1 p-3 flex flex-col gap-2">
                    {hourEvents.map((event) => {
                      const platformColor = PLATFORM_COLORS[event.platform] || "#6366f1";
                      const PlatformIcon = getPlatformIcon(event.platform);
                      return (
                        <div
                          key={event.id}
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowEventDetail(true);
                          }}
                          className="p-3 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md group"
                          style={{
                            background: platformColor + "12",
                            borderLeft: `3px solid ${platformColor}`,
                          }}
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: platformColor }}>
                            <PlatformIcon className="w-4 h-4" />
                            {event.title}
                            {event.isAIRecommended && <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                          </div>
                          <div className="text-xs mt-1 text-gray-500 dark:text-dark-muted capitalize">{event.platform}</div>
                        </div>
                      );
                    })}
                    {hourEvents.length === 0 && (
                      <button
                        onClick={() => handleQuickAdd(selectedDay, hour)}
                        className="text-xs py-1.5 px-2 rounded-lg text-gray-400 dark:text-dark-muted opacity-0 hover:opacity-100 hover:bg-gray-50 dark:hover:bg-dark-surface-2 transition-all duration-200"
                      >
                        <Plus className="w-3 h-3 inline mr-1" />
                        Add event
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Suggestions Panel */}
        <div className="rounded-2xl p-5 h-fit border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-card">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-dark-text">
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI Suggestions
          </h3>
          <div className="space-y-3">
            {PLATFORMS.map((p) => {
              const suggestion = aiSuggestions[p.id as keyof typeof aiSuggestions];
              const PlatformIcon = p.Icon;
              return (
                <div
                  key={p.id}
                  className="p-3 rounded-xl transition-all duration-200 hover:shadow-sm bg-gray-50 dark:bg-dark-surface-2"
                  style={{ borderLeft: `3px solid ${p.color}` }}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: p.color }}>
                    <PlatformIcon className="w-3.5 h-3.5" />
                    {p.name}
                  </div>
                  <div className="text-xs mt-1.5 text-gray-500 dark:text-dark-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Best time: {suggestion.time}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-dark-surface-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${suggestion.score}%`, background: p.color }}
                      />
                    </div>
                    <span className="text-xs font-bold" style={{ color: p.color }}>
                      {suggestion.score}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Content Calendar</h1>
          <p className="text-sm mt-1 text-gray-500 dark:text-dark-muted">{monthName}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Navigation */}
          <div className="flex items-center gap-1 border-r border-gray-200 dark:border-dark-border pr-3">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-dark-surface-2 text-gray-500 dark:text-dark-muted"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/30"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-dark-surface-2 text-gray-500 dark:text-dark-muted"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* View Toggle — Segmented Control */}
          <div className="flex rounded-xl bg-gray-100 dark:bg-dark-surface-2 p-1">
            {views.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                  view === v
                    ? "bg-white dark:bg-dark-surface shadow-sm text-brand-600 dark:text-brand-400"
                    : "text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-dark-text"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <Link
            href="/dashboard/generate"
            className="px-4 py-2 text-sm font-semibold flex items-center gap-2 rounded-xl text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            New Post
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Scheduled", value: scheduledCount, icon: "📅", gradient: "from-brand-500 to-brand-600" },
          { label: "Published", value: publishedCount, icon: "✅", gradient: "from-emerald-500 to-emerald-600" },
          { label: "AI-Recommended", value: aiRecommendedCount, icon: "✨", gradient: "from-purple-500 to-purple-600" },
          { label: "Queue", value: queueCount, icon: "⏳", gradient: "from-amber-500 to-amber-600" },
        ].map((s, i) => (
          <div
            key={i}
            className="relative overflow-hidden p-4 rounded-2xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border shadow-card transition-all duration-200 hover:shadow-elevated"
          >
            <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${s.gradient}`} />
            <div className="flex items-center gap-3 pl-2">
              <span className="text-xl">{s.icon}</span>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-dark-text">{s.value}</div>
                <div className="text-xs font-medium text-gray-500 dark:text-dark-muted">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Calendar Content */}
      {view === "Month" && <MonthView />}
      {view === "Week" && <WeekView />}
      {view === "Day" && (
        <div>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = day === selectedDay;
              const isToday = isCurrentMonth && day === today.getDate();
              const dayHasEvents = getEventsForDay(day).length > 0;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`relative px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                    isSelected
                      ? "bg-brand-500 text-white shadow-md"
                      : isToday
                        ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800"
                        : "bg-white dark:bg-dark-surface text-gray-600 dark:text-dark-muted border border-gray-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700"
                  }`}
                >
                  {day}
                  {dayHasEvents && !isSelected && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-500" />
                  )}
                </button>
              );
            })}
          </div>
          <DayView />
        </div>
      )}

      {/* Platform Legend */}
      <div className="flex items-center gap-4 mt-6 flex-wrap">
        {PLATFORMS.map((p) => {
          const PlatformIcon = p.Icon;
          return (
            <div key={p.id} className="flex items-center gap-1.5">
              <PlatformIcon className="w-3.5 h-3.5" style={{ color: p.color }} />
              <span className="text-xs font-medium text-gray-500 dark:text-dark-muted">{p.name}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-medium text-gray-500 dark:text-dark-muted">AI-Recommended</span>
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
  const MAX_CHARS = 280;

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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-dark-surface rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-200 dark:border-dark-border animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-dark-text">Schedule New Post</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-surface-2 transition-all duration-200 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold mb-2 text-gray-600 dark:text-dark-muted">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title..."
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-dark-surface-2 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Platform Selector — Icon Buttons */}
          <div>
            <label className="block text-xs font-semibold mb-2 text-gray-600 dark:text-dark-muted">Platforms</label>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.map((p) => {
                const isSelected = selectedPlatforms.includes(p.id);
                const PlatformIcon = p.Icon;
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelectedPlatforms(
                        isSelected ? selectedPlatforms.filter((x) => x !== p.id) : [...selectedPlatforms, p.id]
                      )
                    }
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      isSelected ? "shadow-md" : ""
                    }`}
                    style={{
                      background: isSelected ? p.color + "20" : undefined,
                      color: isSelected ? p.color : undefined,
                      border: `2px solid ${isSelected ? p.color : "transparent"}`,
                      boxShadow: isSelected ? `0 0 12px ${p.color}30` : undefined,
                    }}
                  >
                    <PlatformIcon className="w-4 h-4" />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Time */}
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-dark-muted bg-gray-50 dark:bg-dark-surface-2 rounded-xl px-4 py-2.5">
            <Clock className="w-3.5 h-3.5" />
            Day {day} at {String(hour).padStart(2, "0")}:00
          </div>

          {/* AI Toggle — Styled Switch */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-dark-surface-2 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-semibold text-gray-700 dark:text-dark-text">Let AI pick best time</span>
            </div>
            <button
              onClick={() => setUseAI(!useAI)}
              className={`relative w-10 h-6 rounded-full transition-all duration-200 ${
                useAI ? "bg-brand-500" : "bg-gray-300 dark:bg-dark-surface-3"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
                  useAI ? "left-5" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Content Textarea with Character Count */}
          <div>
            <label className="block text-xs font-semibold mb-2 text-gray-600 dark:text-dark-muted">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Post content..."
              className="w-full px-4 py-3 rounded-xl text-sm resize-none bg-gray-50 dark:bg-dark-surface-2 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
              rows={4}
              maxLength={MAX_CHARS}
            />
            <div className="flex justify-end mt-1">
              <span
                className={`text-xs font-medium ${
                  content.length > MAX_CHARS * 0.9
                    ? "text-red-500"
                    : content.length > MAX_CHARS * 0.7
                      ? "text-amber-500"
                      : "text-gray-400 dark:text-dark-muted"
                }`}
              >
                {content.length}/{MAX_CHARS}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-gray-100 dark:bg-dark-surface-2 text-gray-600 dark:text-dark-muted border border-gray-200 dark:border-dark-border hover:bg-gray-200 dark:hover:bg-dark-surface-3"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              Schedule Post
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
  const platformColor = PLATFORM_COLORS[event.platform] || "#6366f1";
  const PlatformIcon = getPlatformIcon(event.platform);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-dark-surface rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-200 dark:border-dark-border animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-dark-text">{event.title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-surface-2 transition-all duration-200 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Platform & Time */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: platformColor + "10", borderLeft: `3px solid ${platformColor}` }}
          >
            <PlatformIcon className="w-5 h-5" style={{ color: platformColor }} />
            <div className="flex-1">
              <div className="text-sm font-semibold capitalize" style={{ color: platformColor }}>
                {event.platform}
              </div>
              <div className="text-xs text-gray-500 dark:text-dark-muted flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                Day {event.day} at {event.time}
              </div>
            </div>
            {event.isAIRecommended && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-[10px] font-semibold">
                <Sparkles className="w-3 h-3" /> AI
              </span>
            )}
          </div>

          {/* Content */}
          {event.content && (
            <div>
              <label className="block text-xs font-semibold mb-2 text-gray-600 dark:text-dark-muted">Content</label>
              <div className="p-3 rounded-xl text-sm bg-gray-50 dark:bg-dark-surface-2 text-gray-700 dark:text-dark-text">
                {event.content}
              </div>
            </div>
          )}

          {/* Reschedule */}
          <div>
            <label className="block text-xs font-semibold mb-2 text-gray-600 dark:text-dark-muted">Reschedule</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="31"
                value={rescheduleDay}
                onChange={(e) => setRescheduleDay(parseInt(e.target.value))}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-dark-surface-2 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                placeholder="Day"
              />
              <input
                type="number"
                min="0"
                max="23"
                value={rescheduleHour}
                onChange={(e) => setRescheduleHour(parseInt(e.target.value))}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-dark-surface-2 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                placeholder="Hour"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => onDelete(event.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
            <button
              onClick={() => onReschedule(rescheduleDay, rescheduleHour)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-md hover:shadow-lg"
            >
              Reschedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
