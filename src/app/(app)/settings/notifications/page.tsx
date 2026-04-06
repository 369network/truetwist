"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  TrendingUp,
  Users,
  CreditCard,
  AlertCircle,
  Calendar,
  BarChart3,
  Save,
} from "lucide-react";

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  icon: typeof Bell;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

const defaultSettings: NotificationSetting[] = [
  { id: "post-published", label: "Post Published", description: "When a scheduled post goes live", icon: MessageSquare, email: false, push: true, inApp: true },
  { id: "post-failed", label: "Post Failed", description: "When a post fails to publish", icon: AlertCircle, email: true, push: true, inApp: true },
  { id: "engagement-spike", label: "Engagement Spike", description: "When a post gets unusually high engagement", icon: TrendingUp, email: true, push: true, inApp: true },
  { id: "trending-alert", label: "Trending Alert", description: "When a trend matches your niche", icon: TrendingUp, email: false, push: true, inApp: true },
  { id: "team-invite", label: "Team Invitations", description: "When someone is invited or joins", icon: Users, email: true, push: false, inApp: true },
  { id: "team-activity", label: "Team Activity", description: "When a team member creates or edits content", icon: Users, email: false, push: false, inApp: true },
  { id: "billing-alerts", label: "Billing Alerts", description: "Payment confirmations, failures, and renewals", icon: CreditCard, email: true, push: true, inApp: true },
  { id: "credits-low", label: "Low Credits", description: "When AI credits drop below 20%", icon: CreditCard, email: true, push: true, inApp: true },
  { id: "weekly-report", label: "Weekly Performance Report", description: "Summary of your weekly analytics", icon: BarChart3, email: true, push: false, inApp: false },
  { id: "monthly-report", label: "Monthly Report", description: "Detailed monthly analytics report", icon: BarChart3, email: true, push: false, inApp: false },
  { id: "calendar-reminder", label: "Calendar Reminders", description: "Upcoming scheduled posts reminder", icon: Calendar, email: false, push: true, inApp: true },
  { id: "ab-test-complete", label: "A/B Test Results", description: "When an A/B test reaches significance", icon: BarChart3, email: true, push: true, inApp: true },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5.5 rounded-full transition-colors ${
        checked ? "bg-brand-500" : "bg-gray-300 dark:bg-dark-border"
      }`}
      style={{ width: 40, height: 22 }}
    >
      <div
        className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[20px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [digestFrequency, setDigestFrequency] = useState("daily");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");

  const updateSetting = (id: string, channel: "email" | "push" | "inApp", value: boolean) => {
    setSettings(
      settings.map((s) => (s.id === id ? { ...s, [channel]: value } : s))
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose how and when you want to be notified</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Column Headers */}
          <div className="flex items-center gap-4 pb-3 mb-3 border-b border-gray-200 dark:border-dark-border">
            <div className="flex-1">
              <span className="text-xs font-semibold text-gray-500 dark:text-dark-muted uppercase tracking-wider">Notification</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="w-14 text-center">
                <div className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-500 dark:text-dark-muted uppercase tracking-wider">
                  <Mail className="w-3 h-3" />
                  Email
                </div>
              </div>
              <div className="w-14 text-center">
                <div className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-500 dark:text-dark-muted uppercase tracking-wider">
                  <Smartphone className="w-3 h-3" />
                  Push
                </div>
              </div>
              <div className="w-14 text-center">
                <div className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-500 dark:text-dark-muted uppercase tracking-wider">
                  <Bell className="w-3 h-3" />
                  In-App
                </div>
              </div>
            </div>
          </div>

          {/* Settings Rows */}
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {settings.map((setting) => (
              <div key={setting.id} className="flex items-center gap-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <setting.icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{setting.label}</p>
                    <p className="text-xs text-gray-400 dark:text-dark-muted truncate">{setting.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-14 flex justify-center">
                    <Toggle
                      checked={setting.email}
                      onChange={(v) => updateSetting(setting.id, "email", v)}
                    />
                  </div>
                  <div className="w-14 flex justify-center">
                    <Toggle
                      checked={setting.push}
                      onChange={(v) => updateSetting(setting.id, "push", v)}
                    />
                  </div>
                  <div className="w-14 flex justify-center">
                    <Toggle
                      checked={setting.inApp}
                      onChange={(v) => updateSetting(setting.id, "inApp", v)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Digest */}
      <Card>
        <CardHeader>
          <CardTitle>Email Digest</CardTitle>
          <CardDescription>Consolidate notifications into a periodic digest</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {["realtime", "daily", "weekly", "off"].map((freq) => (
              <button
                key={freq}
                onClick={() => setDigestFrequency(freq)}
                className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors capitalize ${
                  digestFrequency === freq
                    ? "bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400"
                    : "border-gray-200 dark:border-dark-border text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-surface-2"
                }`}
              >
                {freq === "realtime" ? "Real-time" : freq === "off" ? "Off" : freq}
              </button>
            ))}
          </div>
          {digestFrequency === "daily" && (
            <p className="text-xs text-gray-500 dark:text-dark-muted">
              You&apos;ll receive a daily summary email at 9:00 AM in your timezone.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quiet Hours</CardTitle>
              <CardDescription>Pause push notifications during specific hours</CardDescription>
            </div>
            <Toggle checked={quietHoursEnabled} onChange={setQuietHoursEnabled} />
          </div>
        </CardHeader>
        {quietHoursEnabled && (
          <CardContent>
            <div className="flex items-center gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">From</label>
                <input
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className="h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <span className="text-gray-400 mt-5">to</span>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Until</label>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className="h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Push notifications will be silenced during this time.</p>
          </CardContent>
        )}
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button>
          <Save className="w-4 h-4 mr-1" />
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
