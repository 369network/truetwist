"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCalendarEvents,
  useReschedulePost,
  useAiSuggestionSlots,
  useGenerateWeek,
} from "@/hooks/use-api";
import type { CalendarEvent, AiSuggestionSlot } from "@/lib/api-client";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  PlusCircle,
  CalendarDays,
  Loader2,
  AlertCircle,
  X,
  Flame,
  Wand2,
  Clock,
  Check,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  setHours,
  setMinutes,
} from "date-fns";

const platformColors: Record<string, string> = {
  instagram: "bg-platform-instagram",
  twitter: "bg-platform-twitter",
  linkedin: "bg-platform-linkedin",
  tiktok: "bg-gray-900",
  facebook: "bg-platform-facebook",
  youtube: "bg-platform-youtube",
  pinterest: "bg-platform-pinterest",
  threads: "bg-gray-600",
};

const statusColors: Record<string, string> = {
  draft: "text-gray-400",
  scheduled: "text-blue-500",
  posting: "text-yellow-500",
  posted: "text-green-500",
  failed: "text-red-500",
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1));
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [optimisticMoves, setOptimisticMoves] = useState<Record<string, string>>({});
  const [showAiSlots, setShowAiSlots] = useState(true);
  const [fillWeekConfirm, setFillWeekConfirm] = useState(false);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const { data: eventsData, isLoading, isError, error } = useCalendarEvents(
    calendarStart.toISOString(),
    calendarEnd.toISOString()
  );

  const { data: aiSlotsData } = useAiSuggestionSlots(
    calendarStart.toISOString(),
    calendarEnd.toISOString()
  );

  const reschedule = useReschedulePost();
  const generateWeek = useGenerateWeek();

  const events = eventsData?.data || [];
  const aiSlots = aiSlotsData?.data || [];

  const getEventsForDay = useCallback(
    (day: Date): CalendarEvent[] =>
      events.filter((e) => {
        const eventDate = optimisticMoves[e.id]
          ? parseISO(optimisticMoves[e.id])
          : parseISO(e.scheduledAt);
        return isSameDay(eventDate, day);
      }),
    [events, optimisticMoves]
  );

  const getAiSlotsForDay = useCallback(
    (day: Date): AiSuggestionSlot[] => {
      if (!showAiSlots) return [];
      return aiSlots.filter((s) => isSameDay(parseISO(s.date), day));
    },
    [aiSlots, showAiSlots]
  );

  const handleDragStart = useCallback((e: React.DragEvent, event: CalendarEvent) => {
    if (event.status === "posted" || event.status === "posting") return;
    e.dataTransfer.setData("text/plain", event.id);
    setDraggedEvent(event);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("bg-brand-50", "dark:bg-brand-900/10");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.currentTarget.classList.remove("bg-brand-50", "dark:bg-brand-900/10");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetDay: Date) => {
      e.preventDefault();
      e.currentTarget.classList.remove("bg-brand-50", "dark:bg-brand-900/10");

      if (!draggedEvent) return;
      if (draggedEvent.status === "posted" || draggedEvent.status === "posting") return;

      const originalDate = parseISO(draggedEvent.scheduledAt);
      const newDate = setMinutes(
        setHours(targetDay, originalDate.getHours()),
        originalDate.getMinutes()
      );
      const newDateStr = newDate.toISOString();

      setOptimisticMoves((prev) => ({ ...prev, [draggedEvent.id]: newDateStr }));

      reschedule.mutate(
        {
          postId: draggedEvent.postId,
          scheduleId: draggedEvent.id,
          scheduledAt: newDateStr,
        },
        {
          onError: () => {
            setOptimisticMoves((prev) => {
              const next = { ...prev };
              delete next[draggedEvent.id];
              return next;
            });
          },
          onSuccess: () => {
            setOptimisticMoves((prev) => {
              const next = { ...prev };
              delete next[draggedEvent.id];
              return next;
            });
          },
        }
      );

      setDraggedEvent(null);
    },
    [draggedEvent, reschedule]
  );

  const handleFillWeek = () => {
    generateWeek.mutate(
      {
        start: calendarStart.toISOString(),
        businessId: "", // Uses default business
      },
      {
        onSuccess: () => setFillWeekConfirm(false),
        onError: () => setFillWeekConfirm(false),
      }
    );
    setFillWeekConfirm(false);
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <p className="text-gray-500 dark:text-dark-muted mt-1">
            Plan and schedule your content across all platforms
            {draggedEvent && (
              <span className="text-brand-500 ml-2">
                — Drop to reschedule
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showAiSlots ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAiSlots(!showAiSlots)}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            AI Slots
          </Button>
          <Button variant="outline" size="sm">
            <PlusCircle className="w-4 h-4 mr-1" />
            Add Post
          </Button>
          <Button
            size="sm"
            onClick={() => setFillWeekConfirm(true)}
            disabled={generateWeek.isPending}
          >
            {generateWeek.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-1" />
            )}
            Fill My Week
          </Button>
        </div>
      </div>

      {/* Fill Week Confirmation */}
      {fillWeekConfirm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setFillWeekConfirm(false)}
        >
          <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-brand-500" />
                Fill My Week with AI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-dark-muted">
                AI will generate and schedule a full week of content based on your niche,
                trending topics, and optimal posting times.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setFillWeekConfirm(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" className="flex-1" onClick={handleFillWeek}>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Generate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calendar Controls */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface-2"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold min-w-[180px] text-center">
                {format(currentDate, "MMMM yyyy")}
              </h2>
              <button
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface-2"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {reschedule.isPending && (
                <div className="flex items-center gap-1 text-xs text-brand-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </div>
              )}
              <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
                <TabsList>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="day">Day</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
              <p className="text-sm text-gray-400">Loading calendar...</p>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
              <p className="text-sm text-red-500">Failed to load calendar events</p>
              <p className="text-xs text-gray-400 mt-1">{(error as Error)?.message}</p>
            </div>
          )}

          {/* Calendar Grid */}
          {!isLoading && !isError && (
            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-dark-border rounded-md overflow-hidden">
              {/* Day Headers */}
              {weekDays.map((day) => (
                <div key={day} className="bg-gray-50 dark:bg-dark-surface-2 p-2 text-center text-xs font-medium text-gray-500 dark:text-dark-muted">
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {calendarDays.map((day, i) => {
                const dayEvents = getEventsForDay(day);
                const dayAiSlots = getAiSlotsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());
                const hasTrendPost = dayEvents.some(
                  (e) => e.title?.toLowerCase().includes("trend") || false
                );

                return (
                  <div
                    key={i}
                    className={`bg-white dark:bg-dark-surface min-h-[100px] p-2 transition-colors ${
                      !isCurrentMonth ? "opacity-40" : ""
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div
                        className={`text-xs font-medium ${
                          isToday
                            ? "w-6 h-6 rounded-full gradient-brand text-white flex items-center justify-center"
                            : "text-gray-700 dark:text-dark-text"
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                      {hasTrendPost && (
                        <Flame className="w-3 h-3 text-orange-500" />
                      )}
                    </div>
                    <div className="space-y-1">
                      {/* AI Suggestion Slots */}
                      {dayAiSlots.map((slot, si) => (
                        <a
                          key={`ai-${si}`}
                          href={`/content-studio?scheduledAt=${encodeURIComponent(`${slot.date}T${slot.time}`)}&platforms=${encodeURIComponent(slot.suggestedPlatforms.join(","))}`}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-dashed border-brand-300 dark:border-brand-700 text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
                        >
                          <Sparkles className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">{slot.time} — Generate</span>
                        </a>
                      ))}
                      {/* Events */}
                      {dayEvents.slice(0, 3 - dayAiSlots.length).map((event) => (
                        <div
                          key={event.id}
                          draggable={event.status !== "posted" && event.status !== "posting"}
                          onDragStart={(e) => handleDragStart(e, event)}
                          onClick={() => setSelectedEvent(event)}
                          className={`group cursor-pointer ${
                            event.status !== "posted" && event.status !== "posting"
                              ? "cursor-grab active:cursor-grabbing"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-50 dark:bg-dark-surface-2 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors truncate">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${platformColors[event.platform] || "bg-gray-400"}`} />
                            <span className={`w-1 h-1 rounded-full flex-shrink-0 ${statusColors[event.status] ? statusColors[event.status].replace("text-", "bg-") : "bg-gray-400"}`} />
                            <span className="truncate">{event.title}</span>
                          </div>
                        </div>
                      ))}
                      {dayEvents.length + dayAiSlots.length > 3 && (
                        <p className="text-[10px] text-gray-400 px-1.5">
                          +{dayEvents.length + dayAiSlots.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isError && events.length === 0 && aiSlots.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="w-12 h-12 text-gray-300 dark:text-dark-border mb-4" />
              <p className="font-medium text-gray-500 dark:text-dark-muted">No content scheduled yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first post or let AI fill your week</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm">
                  <PlusCircle className="w-4 h-4 mr-1" />
                  Create Post
                </Button>
                <Button
                  size="sm"
                  onClick={() => setFillWeekConfirm(true)}
                >
                  <Wand2 className="w-4 h-4 mr-1" />
                  Fill My Week
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Scheduled Post</CardTitle>
              <button onClick={() => setSelectedEvent(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-surface-2">
                <X className="w-4 h-4" />
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">{selectedEvent.title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="capitalize">
                    <div className={`w-1.5 h-1.5 rounded-full ${platformColors[selectedEvent.platform]} mr-1`} />
                    {selectedEvent.platform}
                  </Badge>
                  <Badge variant={
                    selectedEvent.status === "posted" ? "success"
                    : selectedEvent.status === "failed" ? "destructive"
                    : "default"
                  }>
                    {selectedEvent.status}
                  </Badge>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                <p>Scheduled: {format(parseISO(selectedEvent.scheduledAt), "PPP 'at' p")}</p>
                {selectedEvent.accountName && <p>Account: {selectedEvent.accountName}</p>}
                <p>Type: {selectedEvent.contentType}</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelectedEvent(null)}>
                  Close
                </Button>
                {selectedEvent.status !== "posted" && selectedEvent.status !== "posting" && (
                  <Button size="sm" className="flex-1">
                    Edit Post
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-dark-muted">
        {Object.entries(platformColors).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="capitalize">{name}</span>
          </div>
        ))}
        <div className="border-l border-gray-200 dark:border-dark-border pl-4 flex gap-3">
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${color.replace("text-", "bg-")}`} />
              <span className="capitalize">{status}</span>
            </div>
          ))}
        </div>
        <div className="border-l border-gray-200 dark:border-dark-border pl-4 flex gap-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-brand-500" />
            <span>AI Suggestion</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Flame className="w-3 h-3 text-orange-500" />
            <span>Trend-aligned</span>
          </div>
        </div>
      </div>
    </div>
  );
}
