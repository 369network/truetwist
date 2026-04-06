"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAnalytics, useSocialAccounts, usePosts } from "@/hooks/use-api";
import {
  CalendarDays,
  TrendingUp,
  Users,
  Sparkles,
  PlusCircle,
  Clock,
  BarChart3,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";

const platformColorMap: Record<string, string> = {
  instagram: "bg-platform-instagram",
  twitter: "bg-platform-twitter",
  linkedin: "bg-platform-linkedin",
  facebook: "bg-platform-facebook",
  tiktok: "bg-gray-900",
  youtube: "bg-red-600",
  pinterest: "bg-red-700",
  threads: "bg-gray-800",
};

export default function DashboardPage() {
  const { data: analyticsData, isLoading: analyticsLoading } = useAnalytics("30d");
  const { data: accountsData, isLoading: accountsLoading } = useSocialAccounts();
  const { data: postsData, isLoading: postsLoading } = usePosts({ pageSize: 5 });

  const analytics = analyticsData?.data;
  const accounts = accountsData?.data || [];
  const recentPosts = postsData?.data || [];

  const formatNum = (n: number): string => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return String(n);
  };

  const metrics = analytics
    ? [
        {
          title: "Posts Scheduled",
          value: String(postsData?.total || 0),
          icon: CalendarDays,
          color: "text-brand-500",
          bgColor: "bg-brand-50 dark:bg-brand-900/20",
        },
        {
          title: "Engagement Rate",
          value: analytics.summary.engagementRate + "%",
          icon: TrendingUp,
          color: "text-green-500",
          bgColor: "bg-green-50 dark:bg-green-900/20",
        },
        {
          title: "Total Followers",
          value: formatNum(analytics.summary.totalFollowers),
          icon: Users,
          color: "text-purple-500",
          bgColor: "bg-purple-50 dark:bg-purple-900/20",
        },
        {
          title: "Total Impressions",
          value: formatNum(analytics.summary.totalImpressions),
          icon: Sparkles,
          color: "text-coral-500",
          bgColor: "bg-coral-50 dark:bg-coral-900/20",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Viral Alert Banner */}
      <div className="gradient-brand rounded-lg p-4 flex items-center gap-3 text-white">
        <Zap className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Trending Opportunity Detected!</p>
          <p className="text-sm text-white/80">#AIProductivity is trending — generate content now to ride the wave.</p>
        </div>
        <Link href="/content-studio">
          <Button variant="secondary" size="sm" className="text-brand-600 bg-white hover:bg-gray-100 flex-shrink-0">
            Create Post
          </Button>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {analyticsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 flex items-center justify-center h-[120px]">
                <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
              </CardContent>
            </Card>
          ))
        ) : (
          metrics.map((metric) => (
            <Card key={metric.title}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-md ${metric.bgColor}`}>
                    <metric.icon className={`w-5 h-5 ${metric.color}`} />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-green-500">
                    <ArrowUpRight className="w-3 h-3" />
                    {analytics?.summary.engagementRate}%
                  </div>
                </div>
                <p className="text-2xl font-bold">{metric.value}</p>
                <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">{metric.title}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/content-studio">
          <Button>
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Post
          </Button>
        </Link>
        <Link href="/calendar">
          <Button variant="secondary">
            <Clock className="w-4 h-4 mr-2" />
            Schedule Content
          </Button>
        </Link>
        <Link href="/analytics">
          <Button variant="outline">
            <BarChart3 className="w-4 h-4 mr-2" />
            View Analytics
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Posts */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-500" />
              Recent Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {postsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
              </div>
            ) : recentPosts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">No posts yet. Create your first post!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentPosts.map((post) => (
                  <div key={post.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-dark-border last:border-0">
                    <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-dark-surface-2 flex items-center justify-center">
                      <CalendarDays className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {post.contentText?.slice(0, 60) || "Untitled Post"}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-dark-muted">
                        {post.contentType} · {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        post.status === "posted" ? "success"
                        : post.status === "failed" ? "destructive"
                        : "secondary"
                      }
                    >
                      {post.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connected Platforms */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connected Platforms</CardTitle>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400 mb-3">No platforms connected</p>
                <Link href="/settings/accounts">
                  <Button variant="outline" size="sm">Connect Accounts</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${platformColorMap[account.platform] || "bg-gray-400"}`} />
                      <span className="text-sm capitalize">{account.platform}</span>
                    </div>
                    <Badge variant={account.tokenStatus === "valid" ? "success" : "warning"}>
                      {account.tokenStatus === "valid" ? "Connected" : "Expiring"}
                    </Badge>
                  </div>
                ))}

                {/* Show unconnected platforms */}
                {["instagram", "twitter", "linkedin", "facebook", "tiktok", "youtube", "pinterest", "threads"]
                  .filter((p) => !accounts.some((a) => a.platform === p))
                  .slice(0, 3)
                  .map((platform) => (
                    <div key={platform} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-gray-300" />
                        <span className="text-sm capitalize text-gray-400">{platform}</span>
                      </div>
                      <Link href="/settings/accounts">
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Connect
                        </Button>
                      </Link>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
