"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Heart,
  Users,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ArrowRight,
  Clock,
  Wand2,
  Flame,
  Share2,
  BarChart3,
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  PenLine,
  Send,
  Eye,
} from "lucide-react";

/* ──────── Mock Data ──────── */

const metrics = [
  {
    label: "Posts Scheduled",
    value: "24",
    change: "+12%",
    trend: "up" as const,
    icon: Calendar,
    color: "text-brand-500",
    bg: "bg-brand-50 dark:bg-brand-900/20",
  },
  {
    label: "Engagement Rate",
    value: "4.8%",
    change: "+0.6%",
    trend: "up" as const,
    icon: Heart,
    color: "text-coral-500",
    bg: "bg-coral-50 dark:bg-coral-900/20",
  },
  {
    label: "Follower Growth",
    value: "+2,834",
    change: "+23%",
    trend: "up" as const,
    icon: Users,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  {
    label: "AI Credits",
    value: "347",
    change: "of 500",
    trend: "neutral" as const,
    icon: Sparkles,
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/20",
  },
];

const activityFeed = [
  {
    id: "a1",
    type: "published",
    title: "Spring Collection Launch",
    platform: "Instagram",
    platformColor: "#E4405F",
    time: "2 min ago",
    icon: CheckCircle2,
    iconColor: "text-green-500",
  },
  {
    id: "a2",
    type: "scheduled",
    title: "Weekly tips thread",
    platform: "Twitter/X",
    platformColor: "#1DA1F2",
    time: "15 min ago",
    icon: Clock,
    iconColor: "text-blue-500",
  },
  {
    id: "a3",
    type: "engagement",
    title: "Product demo video hit 10K views",
    platform: "TikTok",
    platformColor: "#ff0050",
    time: "1 hour ago",
    icon: TrendingUp,
    iconColor: "text-coral-500",
  },
  {
    id: "a4",
    type: "failed",
    title: "API limit reached for carousel post",
    platform: "LinkedIn",
    platformColor: "#0A66C2",
    time: "2 hours ago",
    icon: AlertCircle,
    iconColor: "text-red-500",
  },
  {
    id: "a5",
    type: "draft",
    title: "Behind-the-scenes office tour",
    platform: "YouTube",
    platformColor: "#FF0000",
    time: "3 hours ago",
    icon: PenLine,
    iconColor: "text-gray-400",
  },
];

const quickActions = [
  {
    href: "/content-studio",
    icon: Wand2,
    label: "Generate Content",
    desc: "Create AI-powered posts",
    color: "text-brand-500",
    bg: "bg-brand-50 dark:bg-brand-900/20",
  },
  {
    href: "/calendar",
    icon: Calendar,
    label: "Schedule Posts",
    desc: "Plan your content calendar",
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/20",
  },
  {
    href: "/trends",
    icon: Flame,
    label: "View Trends",
    desc: "Discover viral opportunities",
    color: "text-coral-500",
    bg: "bg-coral-50 dark:bg-coral-900/20",
  },
  {
    href: "/settings/accounts",
    icon: Share2,
    label: "Connect Accounts",
    desc: "Link social profiles",
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
];

const aiSuggestions = [
  {
    id: "s1",
    type: "Trending Topic",
    title: "AI tools for small business",
    description: "This topic is trending +340% in your niche. Create a thread sharing your experience.",
    platforms: ["Twitter/X", "LinkedIn"],
    confidence: 92,
  },
  {
    id: "s2",
    type: "Content Gap",
    title: "Behind-the-scenes content",
    description: "Your audience engages 2.3x more with BTS content. You haven't posted one in 12 days.",
    platforms: ["Instagram", "TikTok"],
    confidence: 87,
  },
  {
    id: "s3",
    type: "Best Time",
    title: "Post today at 6:30 PM",
    description: "Your followers are 45% more active on Sunday evenings. Schedule a post for maximum reach.",
    platforms: ["Instagram", "Facebook"],
    confidence: 78,
  },
];

const platformStats = [
  { name: "Instagram", followers: "12.4K", growth: "+3.2%", color: "#E4405F", posts: 18 },
  { name: "Twitter/X", followers: "8.1K", growth: "+5.1%", color: "#1DA1F2", posts: 32 },
  { name: "LinkedIn", followers: "4.7K", growth: "+2.8%", color: "#0A66C2", posts: 12 },
  { name: "TikTok", followers: "15.2K", growth: "+8.4%", color: "#ff0050", posts: 8 },
  { name: "Facebook", followers: "6.3K", growth: "+1.2%", color: "#1877F2", posts: 14 },
];

const upcomingPosts = [
  { id: "p1", title: "Monday Motivation quote", platform: "Instagram", time: "Tomorrow, 9:00 AM", status: "scheduled" },
  { id: "p2", title: "Product feature highlight", platform: "Twitter/X", time: "Tomorrow, 12:30 PM", status: "scheduled" },
  { id: "p3", title: "Team spotlight: Sarah", platform: "LinkedIn", time: "Tue, 10:00 AM", status: "draft" },
];

/* ──────── Component ──────── */

export default function DashboardHomePage() {
  const [refreshingSuggestions, setRefreshingSuggestions] = useState(false);

  const handleRefreshSuggestions = () => {
    setRefreshingSuggestions(true);
    setTimeout(() => setRefreshingSuggestions(false), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 dark:text-dark-muted text-sm mt-1">
            Welcome back! Here&apos;s your content performance overview.
          </p>
        </div>
        <Button asChild>
          <Link href="/content-studio">
            <Wand2 className="w-4 h-4 mr-2" />
            Generate Content
          </Link>
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500 dark:text-dark-muted">{m.label}</span>
                <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center`}>
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold">{m.value}</div>
              <div className="flex items-center gap-1 mt-1">
                {m.trend === "up" && <ArrowUpRight className="w-3.5 h-3.5 text-green-500" />}
                <span className={`text-xs font-medium ${m.trend === "up" ? "text-green-500" : "text-gray-400 dark:text-dark-muted"}`}>
                  {m.change}
                </span>
                {m.trend === "up" && (
                  <span className="text-xs text-gray-400 dark:text-dark-muted">vs last month</span>
                )}
              </div>
              {m.label === "AI Credits" && (
                <Progress value={69.4} className="mt-3" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid: Activity + Quick Actions + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/analytics" className="text-xs">
                    View All
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityFeed.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-dark-surface-2 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{item.title}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.platformColor }}
                        />
                        <span className="text-xs text-gray-400 dark:text-dark-muted">{item.platform}</span>
                        <span className="text-xs text-gray-300 dark:text-dark-border">&middot;</span>
                        <span className="text-xs text-gray-400 dark:text-dark-muted">{item.time}</span>
                      </div>
                    </div>
                    {item.type === "published" && (
                      <Badge variant="success" className="flex-shrink-0">
                        <Eye className="w-3 h-3 mr-1" />
                        Live
                      </Badge>
                    )}
                    {item.type === "failed" && (
                      <Badge variant="destructive" className="flex-shrink-0">Retry</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions + Upcoming Posts */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-surface-2 transition-colors group"
                  >
                    <div className={`w-9 h-9 rounded-lg ${action.bg} flex items-center justify-center flex-shrink-0`}>
                      <action.icon className={`w-4 h-4 ${action.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {action.label}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-dark-muted">{action.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 dark:text-dark-border group-hover:text-brand-500 transition-colors flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Posts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Upcoming</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/calendar" className="text-xs">
                    Calendar
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingPosts.map((post) => (
                  <div key={post.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-dark-surface-2">
                    <Send className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{post.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 dark:text-dark-muted">{post.platform}</span>
                        <span className="text-xs text-gray-300 dark:text-dark-border">&middot;</span>
                        <span className="text-xs text-gray-400 dark:text-dark-muted">{post.time}</span>
                      </div>
                    </div>
                    <Badge
                      variant={post.status === "scheduled" ? "default" : "secondary"}
                      className="flex-shrink-0 text-[10px]"
                    >
                      {post.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Content Suggestions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <CardTitle>AI Content Suggestions</CardTitle>
                <p className="text-xs text-gray-400 dark:text-dark-muted mt-0.5">Personalized recommendations based on your performance</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshSuggestions}
              disabled={refreshingSuggestions}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${refreshingSuggestions ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={
                    suggestion.type === "Trending Topic" ? "coral" :
                    suggestion.type === "Content Gap" ? "warning" : "default"
                  } className="text-[10px]">
                    {suggestion.type}
                  </Badge>
                  <span className="text-[10px] text-gray-400 font-medium">{suggestion.confidence}% match</span>
                </div>
                <h4 className="text-sm font-semibold mb-1">{suggestion.title}</h4>
                <p className="text-xs text-gray-500 dark:text-dark-muted leading-relaxed mb-3">
                  {suggestion.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {suggestion.platforms.map((p) => (
                      <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                    <Link href="/content-studio">
                      <Zap className="w-3 h-3 mr-1" />
                      Create
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Platform Performance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Platform Performance</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/analytics" className="text-xs">
                <BarChart3 className="w-3 h-3 mr-1" />
                Full Analytics
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {platformStats.map((p) => (
              <div
                key={p.name}
                className="text-center p-4 rounded-lg bg-gray-50 dark:bg-dark-surface-2 hover:shadow-card transition-shadow"
              >
                <div
                  className="w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: `${p.color}15` }}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                </div>
                <p className="text-xs font-medium text-gray-600 dark:text-dark-muted">{p.name}</p>
                <p className="text-lg font-bold mt-0.5" style={{ color: p.color }}>{p.followers}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <ArrowUpRight className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-500 font-medium">{p.growth}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{p.posts} posts this month</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
