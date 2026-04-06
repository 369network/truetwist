"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, TrendingUp, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCalendarEvents } from "@/hooks/use-api";

interface Notification {
  id: string;
  type: "viral" | "posted" | "failed" | "competitor";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Poll calendar events for status changes (posted/failed)
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data: calendarData } = useCalendarEvents(
    weekAgo.toISOString(),
    now.toISOString()
  );

  // Generate notifications from calendar events
  useEffect(() => {
    if (!calendarData?.data) return;

    const newNotifications: Notification[] = [];
    for (const event of calendarData.data) {
      if (event.status === "posted") {
        newNotifications.push({
          id: `posted-${event.id}`,
          type: "posted",
          title: "Post Published",
          message: `"${event.title}" was published on ${event.platform}`,
          timestamp: new Date(event.scheduledAt),
          read: false,
        });
      }
      if (event.status === "failed") {
        newNotifications.push({
          id: `failed-${event.id}`,
          type: "failed",
          title: "Post Failed",
          message: `"${event.title}" failed to publish on ${event.platform}`,
          timestamp: new Date(event.scheduledAt),
          read: false,
        });
      }
    }

    // Only update if we have new notifications
    setNotifications((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const genuinelyNew = newNotifications.filter((n) => !existingIds.has(n.id));
      if (genuinelyNew.length === 0) return prev;
      return [...genuinelyNew, ...prev].slice(0, 50);
    });
  }, [calendarData]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const getIcon = (type: string) => {
    switch (type) {
      case "viral": return <TrendingUp className="w-4 h-4 text-green-500" />;
      case "posted": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "failed": return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "competitor": return <TrendingUp className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-coral-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-dark-surface rounded-lg shadow-lg border border-gray-200 dark:border-dark-border z-50 max-h-[400px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-dark-border">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-brand-500 hover:text-brand-600"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="w-8 h-8 text-gray-300 dark:text-dark-border mb-2" />
                <p className="text-xs text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-dark-surface-2 transition-colors ${
                    !notification.read ? "bg-brand-50/50 dark:bg-brand-900/5" : ""
                  }`}
                >
                  <div className="mt-0.5">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{notification.title}</p>
                    <p className="text-[11px] text-gray-500 dark:text-dark-muted mt-0.5 truncate">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {formatRelativeTime(notification.timestamp)}
                    </p>
                  </div>
                  <button
                    onClick={() => dismissNotification(notification.id)}
                    className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-dark-border"
                  >
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
