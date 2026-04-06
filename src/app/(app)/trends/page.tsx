"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrends, useTrendDetail, useTrendAlerts } from "@/hooks/use-api";
import type { TrendItem, TrendDetail } from "@/lib/api-client";
import {
  Flame,
  TrendingUp,
  Hash,
  Zap,
  Bell,
  X,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  Filter,
  Sparkles,
  Globe,
  ExternalLink,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const platformFilters = [
  { value: "", label: "All Platforms" },
  { value: "twitter", label: "Twitter" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
];

const platformColors: Record<string, string> = {
  twitter: "bg-platform-twitter",
  instagram: "bg-platform-instagram",
  linkedin: "bg-platform-linkedin",
  tiktok: "bg-gray-900",
  facebook: "bg-platform-facebook",
  youtube: "bg-platform-youtube",
  pinterest: "bg-platform-pinterest",
  threads: "bg-gray-600",
};

function ViralScoreBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-red-500"
      : score >= 60
      ? "bg-orange-500"
      : score >= 40
      ? "bg-yellow-500"
      : "bg-gray-400";

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 dark:bg-dark-surface-3 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums">{score}</span>
      {score >= 80 && <Flame className="w-3.5 h-3.5 text-red-500" />}
    </div>
  );
}

export default function TrendsPage() {
  const [platformFilter, setPlatformFilter] = useState("");
  const [selectedTrendId, setSelectedTrendId] = useState<string | null>(null);
  const [showAlerts, setShowAlerts] = useState(false);

  const {
    data: trendsData,
    isLoading,
    isError,
    error,
  } = useTrends(platformFilter ? { platform: platformFilter } : undefined);

  const {
    data: detailData,
    isLoading: detailLoading,
  } = useTrendDetail(selectedTrendId || "");

  const { data: alertsData } = useTrendAlerts();

  const trends = trendsData?.data || [];
  const detail = detailData?.data;
  const alerts = alertsData?.data || [];
  const unreadAlerts = alerts.filter((a) => !a.read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="w-6 h-6 text-orange-500" />
            Viral Trends
          </h1>
          <p className="text-gray-500 dark:text-dark-muted mt-1">
            Discover trending topics and ride the wave
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={platformFilter} onValueChange={setPlatformFilter}>
            <TabsList>
              {platformFilters.map((pf) => (
                <TabsTrigger key={pf.value} value={pf.value}>
                  {pf.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            className="relative"
            onClick={() => setShowAlerts(!showAlerts)}
          >
            <Bell className="w-4 h-4" />
            {unreadAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {unreadAlerts}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Alerts Panel */}
      {showAlerts && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-500" />
                Trend Alerts
              </CardTitle>
              <button
                onClick={() => setShowAlerts(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-surface-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                No alerts yet. We&apos;ll notify you when trending opportunities arise.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-3 rounded-md text-sm ${
                      alert.read
                        ? "bg-gray-50 dark:bg-dark-surface-2"
                        : "bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800"
                    }`}
                  >
                    <Flame className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{alert.topic}</p>
                      <p className="text-gray-500 dark:text-dark-muted text-xs mt-0.5">
                        {alert.message}
                      </p>
                    </div>
                    <ViralScoreBar score={alert.viralScore} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
          <p className="text-sm text-gray-400">Scanning trends...</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-sm text-red-500 font-medium">
              Failed to load trends
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {(error as Error)?.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!isLoading && !isError && trends.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <TrendingUp className="w-12 h-12 text-gray-300 dark:text-dark-border mb-4" />
            <p className="font-medium text-gray-500 dark:text-dark-muted">
              No trends detected
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Check back soon — we&apos;re constantly scanning for viral opportunities
            </p>
          </CardContent>
        </Card>
      )}

      {/* Trends Feed + Detail */}
      {!isLoading && !isError && trends.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trends List */}
          <div className="lg:col-span-2 space-y-3">
            {trends.map((trend) => (
              <Card
                key={trend.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedTrendId === trend.id
                    ? "ring-2 ring-brand-500"
                    : ""
                }`}
                onClick={() => setSelectedTrendId(trend.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">
                          {trend.topic}
                        </h3>
                        <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                          {trend.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <ViralScoreBar score={trend.viralScore} />
                        <div className="flex items-center gap-1 text-xs text-green-500">
                          <ArrowUpRight className="w-3 h-3" />
                          <span>+{trend.velocity}%/hr</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex gap-1">
                          {trend.platforms.map((p) => (
                            <div
                              key={p}
                              className={`w-2 h-2 rounded-full ${
                                platformColors[p] || "bg-gray-400"
                              }`}
                              title={p}
                            />
                          ))}
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {trend.hashtags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] text-brand-500 dark:text-brand-400"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/content-studio?trend=${encodeURIComponent(trend.topic)}&hashtags=${encodeURIComponent(trend.hashtags.join(","))}`;
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      Use Trend
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Trend Detail Sidebar */}
          <div className="space-y-4">
            {!selectedTrendId && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <TrendingUp className="w-8 h-8 text-gray-300 dark:text-dark-border mb-3" />
                  <p className="text-sm text-gray-400">
                    Select a trend to see details
                  </p>
                </CardContent>
              </Card>
            )}

            {selectedTrendId && detailLoading && (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                </CardContent>
              </Card>
            )}

            {detail && (
              <>
                {/* Velocity Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-brand-500" />
                      Velocity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detail.velocityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={detail.velocityData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e5e7eb"
                          />
                          <XAxis
                            dataKey="period"
                            fontSize={10}
                            tickLine={false}
                          />
                          <YAxis fontSize={10} tickLine={false} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "8px",
                              border: "1px solid #e5e7eb",
                              fontSize: "12px",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#F97316"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[180px] text-sm text-gray-400">
                        No velocity data
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Related Hashtags */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Hash className="w-4 h-4 text-brand-500" />
                      Related Hashtags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.relatedHashtags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Example Posts */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4 text-brand-500" />
                      Example Posts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {detail.examplePosts.map((post) => (
                      <div
                        key={post.id}
                        className="p-3 rounded-md bg-gray-50 dark:bg-dark-surface-2 text-sm"
                      >
                        <p className="line-clamp-2">{post.text}</p>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-dark-muted">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                platformColors[post.platform] || "bg-gray-400"
                              }`}
                            />
                            <span>{post.author}</span>
                          </div>
                          <span>{post.engagement.toLocaleString()} engagements</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Action */}
                <Button
                  className="w-full"
                  onClick={() => {
                    window.location.href = `/content-studio?trend=${encodeURIComponent(detail.topic)}&hashtags=${encodeURIComponent(detail.relatedHashtags.join(","))}`;
                  }}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Post About This Trend
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
