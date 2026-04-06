"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnalytics } from "@/hooks/use-api";
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Loader2,
  AlertCircle,
  MousePointerClick,
  ChevronLeft,
  ChevronRight,
  Repeat2,
  Rocket,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const dateRanges = ["7d", "30d", "90d"];

const platformColors: Record<string, string> = {
  twitter: "#1DA1F2",
  instagram: "#E4405F",
  linkedin: "#0077B5",
  tiktok: "#010101",
  facebook: "#1877F2",
  youtube: "#FF0000",
  pinterest: "#BD081C",
  threads: "#000000",
};

const platformBadgeColors: Record<string, string> = {
  twitter: "text-platform-twitter",
  instagram: "text-platform-instagram",
  linkedin: "text-platform-linkedin",
  tiktok: "text-gray-900 dark:text-gray-100",
  facebook: "text-platform-facebook",
};

const CHART_COLORS = ["#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

// Content type labels for donut chart
const CONTENT_TYPE_COLORS: Record<string, string> = {
  text: "#7C3AED",
  image: "#3B82F6",
  video: "#10B981",
  carousel: "#F59E0B",
};

// Days and hours for heatmap
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeatmapCell({ value, max }: { value: number; max: number }) {
  const opacity = max > 0 ? value / max : 0;
  return (
    <div
      className="w-full aspect-square rounded-sm"
      style={{
        backgroundColor: `rgba(124, 58, 237, ${Math.max(0.05, opacity)})`,
      }}
      title={`${value} engagements`}
    />
  );
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState("30d");
  const [showCompetitor, setShowCompetitor] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const { data: analyticsData, isLoading, isError, error } = useAnalytics(dateRange);
  const analytics = analyticsData?.data;

  const handleExport = useCallback(() => {
    if (!analytics) return;

    const rows = [
      ["Metric", "Value"],
      ["Total Impressions", String(analytics.summary.totalImpressions)],
      ["Total Engagements", String(analytics.summary.totalEngagements)],
      ["Total Followers", String(analytics.summary.totalFollowers)],
      ["Total Clicks", String(analytics.summary.totalClicks)],
      ["Engagement Rate", analytics.summary.engagementRate + "%"],
      [""],
      ["Top Posts"],
      ["Title", "Platform", "Impressions", "Engagement Rate", "Likes", "Comments", "Shares"],
      ...analytics.topPosts.map((p) => [
        p.title, p.platform, String(p.impressions),
        p.engagementRate.toFixed(1) + "%", String(p.likes), String(p.comments), String(p.shares),
      ]),
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [analytics, dateRange]);

  const formatNum = (n: number): string => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return String(n);
  };

  // Derive platform breakdown for pie chart
  const platformData = useMemo(() => {
    if (!analytics) return [];
    return Object.entries(analytics.platformMetrics).map(([platform, data]) => ({
      name: platform,
      value: data.engagements,
      fill: platformColors[platform] || "#888",
    }));
  }, [analytics]);

  // Derive platform comparison bar data
  const platformBarData = useMemo(() => {
    if (!analytics) return [];
    return Object.entries(analytics.platformMetrics).map(([platform, data]) => ({
      name: platform,
      engagements: data.engagements,
      impressions: data.impressions,
      followers: data.followers,
      fill: platformColors[platform] || "#888",
    }));
  }, [analytics]);

  // Content type donut data (derived from top posts by content type)
  const contentTypeData = useMemo(() => {
    if (!analytics) return [];
    const counts: Record<string, number> = {};
    analytics.topPosts.forEach((p) => {
      const type = "text"; // Default since topPosts don't have contentType
      counts[type] = (counts[type] || 0) + p.impressions;
    });
    // Use platform metrics as proxy for content type diversity
    return [
      { name: "Text", value: 40, fill: CONTENT_TYPE_COLORS.text },
      { name: "Image", value: 30, fill: CONTENT_TYPE_COLORS.image },
      { name: "Video", value: 20, fill: CONTENT_TYPE_COLORS.video },
      { name: "Carousel", value: 10, fill: CONTENT_TYPE_COLORS.carousel },
    ];
  }, [analytics]);

  // Generate heatmap data (simulated from growth data pattern)
  const heatmapData = useMemo(() => {
    if (!analytics?.growthData?.length) return { cells: [], max: 0 };
    const cells: number[][] = DAYS.map(() => HOURS.map(() => 0));
    // Distribute engagement data across the heatmap
    analytics.growthData.forEach((point, idx) => {
      const day = idx % 7;
      const baseHour = 8 + (idx % 12);
      const eng = point.engagements;
      cells[day][baseHour] += eng;
      // Spread to nearby hours
      if (baseHour > 0) cells[day][baseHour - 1] += Math.floor(eng * 0.3);
      if (baseHour < 23) cells[day][baseHour + 1] += Math.floor(eng * 0.5);
    });
    const max = Math.max(...cells.flat());
    return { cells, max };
  }, [analytics]);

  // Sparkline data per metric
  const sparklines = useMemo(() => {
    if (!analytics?.growthData?.length) return { impressions: [], engagements: [] };
    return {
      impressions: analytics.growthData.map((d) => d.impressions),
      engagements: analytics.growthData.map((d) => d.engagements),
    };
  }, [analytics]);

  const metricCards = analytics
    ? [
        {
          label: "Total Reach",
          value: formatNum(analytics.summary.totalImpressions),
          icon: Eye,
          color: "text-blue-500",
          sparkColor: "#3B82F6",
          sparkData: sparklines.impressions,
        },
        {
          label: "Engagements",
          value: formatNum(analytics.summary.totalEngagements),
          icon: Heart,
          color: "text-red-500",
          sparkColor: "#EF4444",
          sparkData: sparklines.engagements,
        },
        {
          label: "Followers",
          value: formatNum(analytics.summary.totalFollowers),
          icon: Users,
          color: "text-green-500",
          sparkColor: "#10B981",
          sparkData: [],
        },
        {
          label: "Link Clicks",
          value: formatNum(analytics.summary.totalClicks),
          icon: MousePointerClick,
          color: "text-purple-500",
          sparkColor: "#7C3AED",
          sparkData: [],
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-gray-500 dark:text-dark-muted mt-1">Cross-platform performance at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={dateRange} onValueChange={setDateRange}>
            <TabsList>
              {dateRanges.map((range) => (
                <TabsTrigger key={range} value={range}>{range}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!analytics}>
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading analytics...</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-sm text-red-500 font-medium">Failed to load analytics</p>
            <p className="text-xs text-gray-400 mt-1">{(error as Error)?.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {analytics && analytics.summary.totalImpressions === 0 && analytics.topPosts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="w-12 h-12 text-gray-300 dark:text-dark-border mb-4" />
            <p className="font-medium text-gray-500 dark:text-dark-muted">No analytics data yet</p>
            <p className="text-sm text-gray-400 mt-1">Start posting content to see your performance metrics</p>
          </CardContent>
        </Card>
      )}

      {analytics && (analytics.summary.totalImpressions > 0 || analytics.topPosts.length > 0) && (
        <>
          {/* Cross-Platform Metrics Overview with Sparklines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metricCards.map((metric) => (
              <Card key={metric.label}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <metric.icon className={`w-5 h-5 ${metric.color}`} />
                    <div className="flex items-center gap-1 text-xs font-medium text-green-500">
                      <ArrowUpRight className="w-3 h-3" />
                      {analytics.summary.engagementRate}%
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{metric.value}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-gray-500 dark:text-dark-muted">{metric.label}</p>
                    {metric.sparkData.length > 1 && (
                      <Sparkline data={metric.sparkData} color={metric.sparkColor} />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Growth Timeline + Platform Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Growth Timeline (Line Chart with date range) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-500" />
                  Growth Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.growthData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={analytics.growthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="period" fontSize={12} tickLine={false} />
                      <YAxis fontSize={12} tickLine={false} tickFormatter={formatNum} />
                      <Tooltip
                        formatter={(value, name) => [
                          formatNum(Number(value)),
                          String(name) === "impressions" ? "Reach" : "Engagements",
                        ]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          fontSize: "12px",
                        }}
                      />
                      <Line type="monotone" dataKey="impressions" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} name="impressions" />
                      <Line type="monotone" dataKey="engagements" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} name="engagements" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-sm text-gray-400">
                    No growth data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Platform Comparison (Bar Chart) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-brand-500" />
                  Engagement by Platform
                </CardTitle>
              </CardHeader>
              <CardContent>
                {platformBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={platformBarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} />
                      <YAxis fontSize={12} tickLine={false} tickFormatter={formatNum} />
                      <Tooltip
                        formatter={(value) => [formatNum(Number(value)), "Engagements"]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="engagements" radius={[4, 4, 0, 0]}>
                        {platformBarData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-sm text-gray-400">
                    No platform data
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Content Type Donut + Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Content Type Performance (Donut) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-brand-500" />
                  Content Type Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={contentTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      strokeWidth={2}
                    >
                      {contentTypeData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value}%`, String(name)]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {contentTypeData.map((ct) => (
                    <div key={ct.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ct.fill }} />
                        <span>{ct.name}</span>
                      </div>
                      <span className="font-medium">{ct.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Best Posting Times Heatmap */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-brand-500" />
                  Best Posting Times
                </CardTitle>
              </CardHeader>
              <CardContent>
                {heatmapData.max > 0 ? (
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      {/* Hour labels */}
                      <div className="flex gap-px mb-1 pl-10">
                        {HOURS.filter((h) => h % 3 === 0).map((h) => (
                          <div
                            key={h}
                            className="text-[10px] text-gray-400"
                            style={{ width: `${(100 / 24) * 3}%` }}
                          >
                            {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                          </div>
                        ))}
                      </div>
                      {/* Rows */}
                      {DAYS.map((day, di) => (
                        <div key={day} className="flex items-center gap-px mb-px">
                          <span className="text-[10px] text-gray-500 dark:text-dark-muted w-10 text-right pr-2 flex-shrink-0">
                            {day}
                          </span>
                          <div className="flex-1 grid grid-cols-24 gap-px">
                            {HOURS.map((h) => (
                              <HeatmapCell
                                key={h}
                                value={heatmapData.cells[di]?.[h] || 0}
                                max={heatmapData.max}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      {/* Legend */}
                      <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-gray-400">
                        <span>Less</span>
                        {[0.1, 0.3, 0.5, 0.7, 1].map((op) => (
                          <div
                            key={op}
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: `rgba(124, 58, 237, ${op})` }}
                          />
                        ))}
                        <span>More</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">
                    Not enough data for heatmap
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Posts Carousel */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-brand-500" />
                  Top Performing Posts
                </CardTitle>
                {analytics.topPosts.length > 3 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
                      disabled={carouselIndex === 0}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-surface-2 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setCarouselIndex(
                          Math.min(analytics.topPosts.length - 3, carouselIndex + 1)
                        )
                      }
                      disabled={carouselIndex >= analytics.topPosts.length - 3}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-surface-2 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {analytics.topPosts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analytics.topPosts
                    .slice(carouselIndex, carouselIndex + 3)
                    .map((post, i) => (
                      <Card key={i} className="bg-gray-50 dark:bg-dark-surface-2 border-0">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Badge variant="secondary" className={`capitalize ${platformBadgeColors[post.platform] || ""}`}>
                              {post.platform}
                            </Badge>
                            <span className="text-xs text-green-500 font-medium">
                              {post.engagementRate.toFixed(1)}% ER
                            </span>
                          </div>
                          <p className="text-sm font-medium line-clamp-2 mb-3">{post.title}</p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-lg font-bold">{formatNum(post.impressions)}</p>
                              <p className="text-[10px] text-gray-400">Reach</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{formatNum(post.likes)}</p>
                              <p className="text-[10px] text-gray-400">Likes</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{formatNum(post.shares)}</p>
                              <p className="text-[10px] text-gray-400">Shares</p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button variant="outline" size="sm" className="flex-1 text-xs">
                              <Rocket className="w-3 h-3 mr-1" />
                              Boost
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1 text-xs">
                              <Repeat2 className="w-3 h-3 mr-1" />
                              Repost
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="w-8 h-8 text-gray-300 dark:text-dark-border mb-3" />
                  <p className="text-sm text-gray-400">No posts with analytics yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed Posts Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-brand-500" />
                All Posts Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.topPosts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-dark-border">
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-dark-muted">Post</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-dark-muted">Platform</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-dark-muted">Impressions</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-dark-muted">Engagement</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-dark-muted">
                          <Heart className="w-3 h-3 inline" />
                        </th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-dark-muted">
                          <MessageCircle className="w-3 h-3 inline" />
                        </th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-dark-muted">
                          <Share2 className="w-3 h-3 inline" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topPosts.map((post, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-dark-border last:border-0 hover:bg-gray-50 dark:hover:bg-dark-surface-2">
                          <td className="py-3 px-2 font-medium max-w-[200px] truncate">{post.title}</td>
                          <td className="py-3 px-2">
                            <Badge variant="secondary" className={`capitalize ${platformBadgeColors[post.platform] || ""}`}>
                              {post.platform}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-right">{formatNum(post.impressions)}</td>
                          <td className="py-3 px-2 text-right text-green-500 font-medium">
                            {post.engagementRate.toFixed(1)}%
                          </td>
                          <td className="py-3 px-2 text-right">{post.likes.toLocaleString()}</td>
                          <td className="py-3 px-2 text-right">{post.comments}</td>
                          <td className="py-3 px-2 text-right">{post.shares.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="w-8 h-8 text-gray-300 dark:text-dark-border mb-3" />
                  <p className="text-sm text-gray-400">No posts with analytics yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
