"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  useVideoAbTests,
  useVideoAbTest,
  useCreateVideoAbTest,
  useVideoAbTestAction,
  useSelectVideoAbTestWinner,
} from "@/hooks/use-api";
import type { VideoAbTest, VideoAbTestVariant } from "@/lib/api-client";
import {
  Video,
  Trophy,
  Play,
  Square,
  Plus,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  MousePointerClick,
  Clock,
  BarChart3,
  X,
  Check,
  Sparkles,
  Timer,
  Target,
  Percent,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";

const statusFilters = [
  { value: "", label: "All" },
  { value: "generating", label: "Generating" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "draft", label: "Draft" },
];

const VARIANT_COLORS = ["#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

const PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "linkedin",
  "twitter",
];

const VARIATION_FIELDS = [
  { value: "headline", label: "Headline", placeholder: "e.g. Save 50% Today!, Limited Time Offer" },
  { value: "cta", label: "Call to Action", placeholder: "e.g. Shop Now, Learn More, Get Started" },
  { value: "music", label: "Music Mood", placeholder: "e.g. upbeat, calm, dramatic" },
  { value: "template", label: "Template", placeholder: "e.g. text-animation, product-showcase" },
];

function TestStatusBadge({ status }: { status: VideoAbTest["status"] }) {
  switch (status) {
    case "generating":
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
          <Sparkles className="w-3 h-3 mr-1 animate-pulse" />
          Generating
        </Badge>
      );
    case "running":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />
          Running
        </Badge>
      );
    case "completed":
      return <Badge variant="success" className="text-xs">Completed</Badge>;
    case "cancelled":
      return <Badge variant="secondary" className="text-xs">Cancelled</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">Draft</Badge>;
  }
}

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

function VariantStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "ready":
      return <Check className="w-3.5 h-3.5 text-green-500" />;
    case "generating":
      return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
    case "failed":
      return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-gray-400" />;
  }
}

export default function VideoAbTestingPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [newTest, setNewTest] = useState({
    name: "",
    description: "",
    platform: "instagram",
    prompt: "",
    template: "",
    aspectRatio: "9:16" as string,
    durationSeconds: 15,
    targetMetric: "watch_time",
    variationParams: [{ field: "headline", values: ["", ""] }] as Array<{
      field: string;
      values: string[];
    }>,
    autoGenerate: true,
  });

  const {
    data: testsData,
    isLoading,
    isError,
    error,
  } = useVideoAbTests(statusFilter ? { status: statusFilter } : undefined);

  const {
    data: selectedTestData,
    isLoading: detailLoading,
  } = useVideoAbTest(selectedTestId || "");

  const createTest = useCreateVideoAbTest();
  const testAction = useVideoAbTestAction();
  const selectWinner = useSelectVideoAbTestWinner();

  const tests = testsData?.data || [];
  const selectedTest = selectedTestData?.data;
  const significance = (selectedTestData?.data as unknown as { significance?: { confidence: number; significant: boolean; reason: string } })?.significance;

  const variantChartData = useMemo(() => {
    if (!selectedTest) return [];
    return selectedTest.variants.map((v: VideoAbTestVariant, i: number) => ({
      name: `Variant ${v.label}`,
      impressions: v.impressions,
      clicks: v.clicks,
      watchTime: Math.round(v.watchTimeSeconds),
      conversions: v.conversions,
      fill: VARIANT_COLORS[i % VARIANT_COLORS.length],
    }));
  }, [selectedTest]);

  const radarData = useMemo(() => {
    if (!selectedTest || selectedTest.variants.length === 0) return [];
    const maxImp = Math.max(...selectedTest.variants.map((v: VideoAbTestVariant) => v.impressions), 1);
    const maxClk = Math.max(...selectedTest.variants.map((v: VideoAbTestVariant) => v.clicks), 1);
    const maxWt = Math.max(...selectedTest.variants.map((v: VideoAbTestVariant) => v.watchTimeSeconds), 1);
    const maxConv = Math.max(...selectedTest.variants.map((v: VideoAbTestVariant) => v.conversions), 1);
    const maxEng = Math.max(...selectedTest.variants.map((v: VideoAbTestVariant) => v.engagementRate), 1);

    return [
      { metric: "Impressions", ...Object.fromEntries(selectedTest.variants.map((v: VideoAbTestVariant) => [v.label, (v.impressions / maxImp) * 100])) },
      { metric: "Clicks", ...Object.fromEntries(selectedTest.variants.map((v: VideoAbTestVariant) => [v.label, (v.clicks / maxClk) * 100])) },
      { metric: "Watch Time", ...Object.fromEntries(selectedTest.variants.map((v: VideoAbTestVariant) => [v.label, (v.watchTimeSeconds / maxWt) * 100])) },
      { metric: "Conversions", ...Object.fromEntries(selectedTest.variants.map((v: VideoAbTestVariant) => [v.label, (v.conversions / maxConv) * 100])) },
      { metric: "Engagement", ...Object.fromEntries(selectedTest.variants.map((v: VideoAbTestVariant) => [v.label, (v.engagementRate / maxEng) * 100])) },
    ];
  }, [selectedTest]);

  const handleCreateTest = () => {
    const cleanedParams = newTest.variationParams
      .filter((p) => p.values.some((v) => v.trim()))
      .map((p) => ({
        field: p.field,
        values: p.values.filter((v) => v.trim()),
      }));

    if (cleanedParams.length === 0) return;

    createTest.mutate(
      {
        businessId: "", // will be set from user's active business
        name: newTest.name,
        description: newTest.description || undefined,
        targetMetric: newTest.targetMetric,
        baseConfig: {
          prompt: newTest.prompt,
          platform: newTest.platform,
          template: newTest.template || undefined,
          aspectRatio: newTest.aspectRatio,
          durationSeconds: newTest.durationSeconds,
        },
        variationParams: cleanedParams,
        autoGenerate: newTest.autoGenerate,
      },
      {
        onSuccess: () => {
          setShowWizard(false);
          setWizardStep(0);
          setNewTest({
            name: "",
            description: "",
            platform: "instagram",
            prompt: "",
            template: "",
            aspectRatio: "9:16",
            durationSeconds: 15,
            targetMetric: "watch_time",
            variationParams: [{ field: "headline", values: ["", ""] }],
            autoGenerate: true,
          });
        },
      }
    );
  };

  const addVariationParam = () => {
    if (newTest.variationParams.length >= 4) return;
    setNewTest((prev) => ({
      ...prev,
      variationParams: [
        ...prev.variationParams,
        { field: "cta", values: ["", ""] },
      ],
    }));
  };

  const removeVariationParam = (index: number) => {
    setNewTest((prev) => ({
      ...prev,
      variationParams: prev.variationParams.filter((_, i) => i !== index),
    }));
  };

  const updateVariationField = (index: number, field: string) => {
    setNewTest((prev) => {
      const params = [...prev.variationParams];
      params[index] = { ...params[index], field };
      return { ...prev, variationParams: params };
    });
  };

  const updateVariationValue = (paramIndex: number, valueIndex: number, value: string) => {
    setNewTest((prev) => {
      const params = [...prev.variationParams];
      const values = [...params[paramIndex].values];
      values[valueIndex] = value;
      params[paramIndex] = { ...params[paramIndex], values };
      return { ...prev, variationParams: params };
    });
  };

  const addVariationValue = (paramIndex: number) => {
    setNewTest((prev) => {
      const params = [...prev.variationParams];
      if (params[paramIndex].values.length >= 5) return prev;
      params[paramIndex] = {
        ...params[paramIndex],
        values: [...params[paramIndex].values, ""],
      };
      return { ...prev, variationParams: params };
    });
  };

  const canProceedStep0 = newTest.name && newTest.prompt;
  const canProceedStep1 = newTest.variationParams.some((p) =>
    p.values.filter((v) => v.trim()).length >= 2
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6 text-brand-500" />
            Video A/B Testing
          </h1>
          <p className="text-gray-500 dark:text-dark-muted mt-1">
            Auto-generate video variants and track performance
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
            New Video Test
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
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Create Video A/B Test — Step {wizardStep + 1} of 3
              </CardTitle>
              <button
                onClick={() => setShowWizard(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-surface-2"
              >
                <X className="w-4 h-4" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step 0: Base video config */}
              {wizardStep === 0 && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Test Name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="e.g. Holiday Sale Video Variants"
                      value={newTest.name}
                      onChange={(e) => setNewTest((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Video Prompt</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                      rows={3}
                      placeholder="Describe the video you want to generate..."
                      value={newTest.prompt}
                      onChange={(e) => setNewTest((prev) => ({ ...prev, prompt: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Platform</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        value={newTest.platform}
                        onChange={(e) => setNewTest((prev) => ({ ...prev, platform: e.target.value }))}
                      >
                        {PLATFORMS.map((p) => (
                          <option key={p} value={p} className="capitalize">
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Aspect Ratio</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        value={newTest.aspectRatio}
                        onChange={(e) => setNewTest((prev) => ({ ...prev, aspectRatio: e.target.value }))}
                      >
                        <option value="9:16">9:16 (Vertical)</option>
                        <option value="16:9">16:9 (Horizontal)</option>
                        <option value="1:1">1:1 (Square)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Duration (seconds)</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        value={newTest.durationSeconds}
                        onChange={(e) => setNewTest((prev) => ({ ...prev, durationSeconds: Number(e.target.value) }))}
                      >
                        {[5, 10, 15, 30, 60].map((d) => (
                          <option key={d} value={d}>{d}s</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Target Metric</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        value={newTest.targetMetric}
                        onChange={(e) => setNewTest((prev) => ({ ...prev, targetMetric: e.target.value }))}
                      >
                        <option value="watch_time">Watch Time</option>
                        <option value="clicks">Clicks</option>
                        <option value="conversions">Conversions</option>
                        <option value="engagement_rate">Engagement Rate</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Step 1: Variation parameters */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 dark:text-dark-muted">
                    Choose what to vary between video versions. Each parameter generates different variants.
                  </p>
                  {newTest.variationParams.map((param, pi) => (
                    <div key={pi} className="border border-gray-200 dark:border-dark-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <select
                          className="px-2 py-1 border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          value={param.field}
                          onChange={(e) => updateVariationField(pi, e.target.value)}
                        >
                          {VARIATION_FIELDS.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                        {newTest.variationParams.length > 1 && (
                          <button
                            onClick={() => removeVariationParam(pi)}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-surface-2 text-gray-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {param.values.map((val, vi) => (
                        <input
                          key={vi}
                          type="text"
                          className="w-full px-3 py-1.5 border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder={VARIATION_FIELDS.find((f) => f.value === param.field)?.placeholder || `Value ${vi + 1}`}
                          value={val}
                          onChange={(e) => updateVariationValue(pi, vi, e.target.value)}
                        />
                      ))}
                      {param.values.length < 5 && (
                        <button
                          onClick={() => addVariationValue(pi)}
                          className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add value
                        </button>
                      )}
                    </div>
                  ))}
                  {newTest.variationParams.length < 4 && (
                    <Button variant="outline" size="sm" onClick={addVariationParam}>
                      <Plus className="w-3 h-3 mr-1" />
                      Add Parameter
                    </Button>
                  )}
                </div>
              )}

              {/* Step 2: Review & confirm */}
              {wizardStep === 2 && (
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-dark-surface-2 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium">{newTest.name}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-muted line-clamp-2">
                      {newTest.prompt}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs capitalize">{newTest.platform}</Badge>
                      <Badge variant="secondary" className="text-xs">{newTest.aspectRatio}</Badge>
                      <Badge variant="secondary" className="text-xs">{newTest.durationSeconds}s</Badge>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {newTest.targetMetric.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Variations</p>
                    {newTest.variationParams
                      .filter((p) => p.values.some((v) => v.trim()))
                      .map((param, i) => (
                        <div key={i} className="text-sm mb-1">
                          <span className="text-gray-500 dark:text-dark-muted capitalize">
                            {param.field}:
                          </span>{" "}
                          {param.values.filter((v) => v.trim()).join(" / ")}
                        </div>
                      ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTest.autoGenerate}
                        onChange={(e) =>
                          setNewTest((prev) => ({ ...prev, autoGenerate: e.target.checked }))
                        }
                        className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                      />
                      Generate videos immediately
                    </label>
                  </div>
                </div>
              )}

              {/* Nav */}
              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    wizardStep > 0 ? setWizardStep(wizardStep - 1) : setShowWizard(false)
                  }
                >
                  {wizardStep > 0 ? "Back" : "Cancel"}
                </Button>
                {wizardStep < 2 ? (
                  <Button
                    size="sm"
                    onClick={() => setWizardStep(wizardStep + 1)}
                    disabled={wizardStep === 0 ? !canProceedStep0 : !canProceedStep1}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleCreateTest}
                    disabled={createTest.isPending}
                  >
                    {createTest.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-1" />
                    )}
                    Create Test
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
          <p className="text-sm text-gray-400">Loading video tests...</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-sm text-red-500 font-medium">Failed to load tests</p>
            <p className="text-xs text-gray-400 mt-1">{(error as Error)?.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!isLoading && !isError && tests.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Video className="w-12 h-12 text-gray-300 dark:text-dark-border mb-4" />
            <p className="font-medium text-gray-500 dark:text-dark-muted">
              No video A/B tests yet
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Create your first test to optimize video ad creatives
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
                    {test.variants.length} variants &middot; {test.baseConfig.platform}
                  </p>
                  {test.status === "generating" && (
                    <div className="mt-2">
                      <Progress
                        value={
                          (test.variants.filter((v: VideoAbTestVariant) => v.status === "ready").length /
                            test.variants.length) *
                          100
                        }
                        className="h-1.5"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {test.variants.filter((v: VideoAbTestVariant) => v.status === "ready").length}/
                        {test.variants.length} videos ready
                      </p>
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
                  <Video className="w-8 h-8 text-gray-300 dark:text-dark-border mb-3" />
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
                        <h2 className="font-semibold text-lg">{selectedTest.name}</h2>
                        <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">
                          {selectedTest.baseConfig.platform} &middot;{" "}
                          {selectedTest.baseConfig.aspectRatio || "9:16"} &middot;{" "}
                          {selectedTest.baseConfig.durationSeconds || 15}s &middot;{" "}
                          Target: {selectedTest.targetMetric.replace("_", " ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TestStatusBadge status={selectedTest.status} />
                        {selectedTest.status === "draft" && (
                          <Button
                            size="sm"
                            onClick={() => testAction.mutate({ id: selectedTest.id, action: "generate" })}
                            disabled={testAction.isPending}
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1" />
                            Generate
                          </Button>
                        )}
                        {selectedTest.status === "running" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => selectWinner.mutate({ testId: selectedTest.id })}
                              disabled={selectWinner.isPending}
                            >
                              <Trophy className="w-3.5 h-3.5 mr-1" />
                              Auto-Pick Winner
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => testAction.mutate({ id: selectedTest.id, action: "cancel" })}
                              disabled={testAction.isPending}
                            >
                              <Square className="w-3.5 h-3.5 mr-1" />
                              Stop
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {significance && <ConfidenceBadge confidence={significance.confidence} />}
                  </CardContent>
                </Card>

                {/* Variant Video Previews (during generating/running) */}
                {["generating", "running", "completed"].includes(selectedTest.status) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedTest.variants.map((variant: VideoAbTestVariant, i: number) => (
                      <Card key={variant.id} className={variant.isWinner ? "ring-2 ring-green-500 relative" : ""}>
                        {variant.isWinner && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center z-10">
                            <Trophy className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <CardContent className="p-3">
                          <div className="aspect-[9/16] bg-gray-100 dark:bg-dark-surface-2 rounded-md mb-2 flex items-center justify-center overflow-hidden relative">
                            {variant.thumbnailUrl ? (
                              <img
                                src={variant.thumbnailUrl}
                                alt={`Variant ${variant.label}`}
                                className="w-full h-full object-cover"
                              />
                            ) : variant.status === "generating" ? (
                              <div className="text-center">
                                <Loader2 className="w-6 h-6 text-brand-500 animate-spin mx-auto mb-1" />
                                <p className="text-xs text-gray-400">Generating...</p>
                              </div>
                            ) : variant.status === "failed" ? (
                              <div className="text-center">
                                <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
                                <p className="text-xs text-red-400">Failed</p>
                              </div>
                            ) : (
                              <Video className="w-8 h-8 text-gray-300" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
                            />
                            <span className="text-sm font-medium">Variant {variant.label}</span>
                            <VariantStatusIcon status={variant.status} />
                          </div>
                          {selectedTest.status === "running" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-1 text-xs h-7"
                              onClick={() => selectWinner.mutate({ testId: selectedTest.id, winnerId: variant.id })}
                              disabled={selectWinner.isPending}
                            >
                              <Trophy className="w-3 h-3 mr-1" />
                              Pick Winner
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Performance Charts (running/completed) */}
                {["running", "completed"].includes(selectedTest.status) && (
                  <>
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
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="name" fontSize={12} tickLine={false} />
                              <YAxis fontSize={12} tickLine={false} />
                              <Tooltip
                                contentStyle={{
                                  borderRadius: "8px",
                                  border: "1px solid #e5e7eb",
                                  fontSize: "12px",
                                }}
                              />
                              <Bar dataKey="impressions" name="Impressions" radius={[4, 4, 0, 0]}>
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

                    {/* Radar Chart */}
                    {radarData.length > 0 && selectedTest.variants.some((v: VideoAbTestVariant) => v.impressions > 0) && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Target className="w-4 h-4 text-brand-500" />
                            Multi-Metric Comparison
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <RadarChart data={radarData}>
                              <PolarGrid />
                              <PolarAngleAxis dataKey="metric" fontSize={11} />
                              {selectedTest.variants.map((v: VideoAbTestVariant, i: number) => (
                                <Radar
                                  key={v.id}
                                  name={`Variant ${v.label}`}
                                  dataKey={v.label}
                                  stroke={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                                  fill={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                                  fillOpacity={0.15}
                                />
                              ))}
                              <Tooltip />
                            </RadarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}

                    {/* Variant Detail Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedTest.variants.map((variant: VideoAbTestVariant, i: number) => (
                        <Card
                          key={variant.id}
                          className={variant.isWinner ? "ring-2 ring-green-500 relative" : ""}
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
                                style={{ backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
                              />
                              <h4 className="font-medium text-sm">Variant {variant.label}</h4>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1 text-gray-500 dark:text-dark-muted">
                                  <Eye className="w-3.5 h-3.5" /> Impressions
                                </span>
                                <span className="font-medium">{variant.impressions.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1 text-gray-500 dark:text-dark-muted">
                                  <MousePointerClick className="w-3.5 h-3.5" /> Clicks
                                </span>
                                <span className="font-medium">{variant.clicks.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1 text-gray-500 dark:text-dark-muted">
                                  <Timer className="w-3.5 h-3.5" /> Avg Watch Time
                                </span>
                                <span className="font-medium">{variant.watchTimeSeconds.toFixed(1)}s</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1 text-gray-500 dark:text-dark-muted">
                                  <Percent className="w-3.5 h-3.5" /> Completion Rate
                                </span>
                                <span className="font-medium">{variant.completionRate.toFixed(1)}%</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1 text-gray-500 dark:text-dark-muted">
                                  <Target className="w-3.5 h-3.5" /> Conversions
                                </span>
                                <span className="font-medium">{variant.conversions.toLocaleString()}</span>
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

                {/* Winner Banner */}
                {selectedTest.status === "completed" && selectedTest.winnerReason && (
                  <Card className="bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Trophy className="w-6 h-6 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-300">
                          Winner Selected
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          {selectedTest.winnerReason}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
