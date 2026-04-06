"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAbTests, useAbTest, useCreateAbTest, useStopAbTest, usePosts } from "@/hooks/use-api";
import type { AbTest } from "@/lib/api-client";
import {
  FlaskConical,
  Trophy,
  Play,
  Square,
  Plus,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  Heart,
  MousePointerClick,
  BarChart3,
  X,
  Check,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const statusFilters = [
  { value: "", label: "All" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "draft", label: "Draft" },
];

const VARIANT_COLORS = ["#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 95) {
    return (
      <Badge variant="success" className="text-xs">
        <Check className="w-3 h-3 mr-1" />
        {confidence}% confident
      </Badge>
    );
  }
  if (confidence >= 80) {
    return (
      <Badge variant="warning" className="text-xs">
        {confidence}% confident
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      <Clock className="w-3 h-3 mr-1" />
      {confidence}% — gathering data
    </Badge>
  );
}

function TestStatusBadge({ status }: { status: AbTest["status"] }) {
  switch (status) {
    case "running":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />
          Running
        </Badge>
      );
    case "completed":
      return <Badge variant="success" className="text-xs">Completed</Badge>;
    case "stopped":
      return <Badge variant="secondary" className="text-xs">Stopped</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">Draft</Badge>;
  }
}

export default function AbTestingPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [newTest, setNewTest] = useState({
    name: "",
    variants: [{ postId: "", label: "Variant A" }, { postId: "", label: "Variant B" }],
    platforms: [] as string[],
    duration: 24,
  });

  const {
    data: testsData,
    isLoading,
    isError,
    error,
  } = useAbTests(statusFilter ? { status: statusFilter } : undefined);

  const {
    data: selectedTestData,
    isLoading: detailLoading,
  } = useAbTest(selectedTestId || "");

  const createTest = useCreateAbTest();
  const stopTest = useStopAbTest();
  const { data: postsData } = usePosts({ status: "draft" });

  const tests = testsData?.data || [];
  const selectedTest = selectedTestData?.data;
  const drafts = postsData?.data || [];

  const variantChartData = useMemo(() => {
    if (!selectedTest) return [];
    return selectedTest.variants.map((v, i) => ({
      name: v.label,
      impressions: v.impressions,
      engagements: v.engagements,
      clicks: v.clicks,
      fill: VARIANT_COLORS[i % VARIANT_COLORS.length],
    }));
  }, [selectedTest]);

  const handleCreateTest = () => {
    createTest.mutate(newTest, {
      onSuccess: () => {
        setShowWizard(false);
        setWizardStep(0);
        setNewTest({
          name: "",
          variants: [{ postId: "", label: "Variant A" }, { postId: "", label: "Variant B" }],
          platforms: [],
          duration: 24,
        });
      },
    });
  };

  const togglePlatform = (p: string) => {
    setNewTest((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(p)
        ? prev.platforms.filter((x) => x !== p)
        : [...prev.platforms, p],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-brand-500" />
            A/B Testing
          </h1>
          <p className="text-gray-500 dark:text-dark-muted mt-1">
            Test content variants and find what resonates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              {statusFilters.map((sf) => (
                <TabsTrigger key={sf.value} value={sf.value}>
                  {sf.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button size="sm" onClick={() => setShowWizard(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New Test
          </Button>
        </div>
      </div>

      {/* Create Wizard Modal */}
      {showWizard && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowWizard(false)}
        >
          <Card
            className="w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Create A/B Test — Step {wizardStep + 1} of 3
              </CardTitle>
              <button
                onClick={() => setShowWizard(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-surface-2"
              >
                <X className="w-4 h-4" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step 0: Name + variants */}
              {wizardStep === 0 && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Test Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="e.g. Emoji vs No Emoji CTA"
                      value={newTest.name}
                      onChange={(e) =>
                        setNewTest((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Select Post Variants
                    </label>
                    {newTest.variants.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium w-20">
                          {v.label}
                        </span>
                        <select
                          className="flex-1 px-3 py-2 border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          value={v.postId}
                          onChange={(e) => {
                            const variants = [...newTest.variants];
                            variants[i] = { ...variants[i], postId: e.target.value };
                            setNewTest((prev) => ({ ...prev, variants }));
                          }}
                        >
                          <option value="">Select a draft post...</option>
                          {drafts.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.contentText?.slice(0, 60) || "Untitled draft"}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    {newTest.variants.length < 4 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1"
                        onClick={() =>
                          setNewTest((prev) => ({
                            ...prev,
                            variants: [
                              ...prev.variants,
                              {
                                postId: "",
                                label: `Variant ${String.fromCharCode(65 + prev.variants.length)}`,
                              },
                            ],
                          }))
                        }
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Variant
                      </Button>
                    )}
                  </div>
                </>
              )}

              {/* Step 1: Platforms */}
              {wizardStep === 1 && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Target Platforms
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {["twitter", "instagram", "linkedin", "tiktok", "facebook", "youtube"].map((p) => (
                      <button
                        key={p}
                        onClick={() => togglePlatform(p)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm capitalize transition-colors ${
                          newTest.platforms.includes(p)
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600"
                            : "border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface-2"
                        }`}
                      >
                        {newTest.platforms.includes(p) && (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Duration */}
              {wizardStep === 2 && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Test Duration
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[12, 24, 48, 72, 168].map((hrs) => (
                      <button
                        key={hrs}
                        onClick={() =>
                          setNewTest((prev) => ({
                            ...prev,
                            duration: hrs,
                          }))
                        }
                        className={`px-3 py-2.5 rounded-md border text-sm transition-colors ${
                          newTest.duration === hrs
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600"
                            : "border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface-2"
                        }`}
                      >
                        {hrs < 48
                          ? `${hrs}h`
                          : `${hrs / 24}d`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nav */}
              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    wizardStep > 0
                      ? setWizardStep(wizardStep - 1)
                      : setShowWizard(false)
                  }
                >
                  {wizardStep > 0 ? "Back" : "Cancel"}
                </Button>
                {wizardStep < 2 ? (
                  <Button
                    size="sm"
                    onClick={() => setWizardStep(wizardStep + 1)}
                    disabled={
                      wizardStep === 0 &&
                      (!newTest.name || newTest.variants.some((v) => !v.postId))
                    }
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleCreateTest}
                    disabled={
                      createTest.isPending || newTest.platforms.length === 0
                    }
                  >
                    {createTest.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Play className="w-4 h-4 mr-1" />
                    )}
                    Launch Test
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading tests...</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-sm text-red-500 font-medium">
              Failed to load tests
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {(error as Error)?.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!isLoading && !isError && tests.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FlaskConical className="w-12 h-12 text-gray-300 dark:text-dark-border mb-4" />
            <p className="font-medium text-gray-500 dark:text-dark-muted">
              No A/B tests yet
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Create your first test to find out what content your audience loves
            </p>
            <Button className="mt-4" size="sm" onClick={() => setShowWizard(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Create First Test
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tests Grid + Detail */}
      {!isLoading && !isError && tests.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tests List */}
          <div className="lg:col-span-1 space-y-3">
            {tests.map((test) => (
              <Card
                key={test.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedTestId === test.id ? "ring-2 ring-brand-500" : ""
                }`}
                onClick={() => setSelectedTestId(test.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-sm truncate flex-1">
                      {test.name}
                    </h3>
                    <TestStatusBadge status={test.status} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-dark-muted">
                    {test.variants.length} variants &middot;{" "}
                    {test.platforms.join(", ")}
                  </p>
                  {test.status === "completed" && (
                    <div className="mt-2">
                      <ConfidenceBadge confidence={test.confidence} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detail View */}
          <div className="lg:col-span-2 space-y-4">
            {!selectedTestId && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <FlaskConical className="w-8 h-8 text-gray-300 dark:text-dark-border mb-3" />
                  <p className="text-sm text-gray-400">
                    Select a test to view results
                  </p>
                </CardContent>
              </Card>
            )}

            {selectedTestId && detailLoading && (
              <Card>
                <CardContent className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                </CardContent>
              </Card>
            )}

            {selectedTest && (
              <>
                {/* Header */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="font-semibold text-lg">
                          {selectedTest.name}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">
                          {selectedTest.platforms.map((p) => p).join(", ")} &middot;{" "}
                          {selectedTest.duration}h duration
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TestStatusBadge status={selectedTest.status} />
                        {selectedTest.status === "running" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => stopTest.mutate(selectedTest.id)}
                            disabled={stopTest.isPending}
                          >
                            <Square className="w-3.5 h-3.5 mr-1" />
                            Stop
                          </Button>
                        )}
                      </div>
                    </div>
                    <ConfidenceBadge confidence={selectedTest.confidence} />
                  </CardContent>
                </Card>

                {/* Variant Comparison Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-brand-500" />
                      Variant Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {variantChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={variantChartData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e5e7eb"
                          />
                          <XAxis dataKey="name" fontSize={12} tickLine={false} />
                          <YAxis fontSize={12} tickLine={false} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "8px",
                              border: "1px solid #e5e7eb",
                              fontSize: "12px",
                            }}
                          />
                          <Bar
                            dataKey="engagements"
                            name="Engagements"
                            radius={[4, 4, 0, 0]}
                          >
                            {variantChartData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[250px] text-sm text-gray-400">
                        No data yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Variant Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedTest.variants.map((variant, i) => (
                    <Card
                      key={variant.id}
                      className={
                        variant.isWinner
                          ? "ring-2 ring-green-500 relative"
                          : ""
                      }
                    >
                      {variant.isWinner && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <Trophy className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor:
                                VARIANT_COLORS[i % VARIANT_COLORS.length],
                            }}
                          />
                          <h4 className="font-medium text-sm">
                            {variant.label}
                          </h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1 text-gray-500 dark:text-dark-muted">
                              <Eye className="w-3.5 h-3.5" />
                              Impressions
                            </span>
                            <span className="font-medium">
                              {variant.impressions.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1 text-gray-500 dark:text-dark-muted">
                              <Heart className="w-3.5 h-3.5" />
                              Engagements
                            </span>
                            <span className="font-medium">
                              {variant.engagements.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1 text-gray-500 dark:text-dark-muted">
                              <MousePointerClick className="w-3.5 h-3.5" />
                              Clicks
                            </span>
                            <span className="font-medium">
                              {variant.clicks.toLocaleString()}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-gray-100 dark:border-dark-border">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500 dark:text-dark-muted">
                                Engagement Rate
                              </span>
                              <span className="font-bold text-brand-500">
                                {variant.engagementRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
