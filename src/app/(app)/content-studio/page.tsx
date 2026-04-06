"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useGenerateText, useGenerateImages, useSchedulePost, useCreatePost, useSocialAccounts } from "@/hooks/use-api";
import {
  Type,
  ImageIcon,
  Video,
  Wand2,
  Copy,
  Clock,
  Send,
  Sparkles,
  Hash,
  Palette,
  Crop,
  Download,
  Play,
  Loader2,
  AlertCircle,
  Check,
  Save,
} from "lucide-react";

const platforms = [
  { id: "instagram", label: "Instagram", color: "bg-platform-instagram", maxChars: 2200 },
  { id: "twitter", label: "Twitter/X", color: "bg-platform-twitter", maxChars: 280 },
  { id: "linkedin", label: "LinkedIn", color: "bg-platform-linkedin", maxChars: 3000 },
  { id: "tiktok", label: "TikTok", color: "bg-platform-tiktok", maxChars: 2200 },
  { id: "facebook", label: "Facebook", color: "bg-platform-facebook", maxChars: 63206 },
];

const imageStyles = ["Minimalist", "Bold", "Elegant", "Playful", "Corporate", "Vintage"];

const videoTypes = [
  { id: "talking-head", label: "Talking Head" },
  { id: "text-animation", label: "Text Animation" },
  { id: "product-showcase", label: "Product Showcase" },
];

export default function ContentStudioPage() {
  const [prompt, setPrompt] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "twitter"]);
  const [imagePrompt, setImagePrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("Minimalist");
  const [videoType, setVideoType] = useState("text-animation");
  const [videoProgress, setVideoProgress] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<string | null>(null);

  const generateText = useGenerateText();
  const generateImages = useGenerateImages();
  const createPost = useCreatePost();
  const { data: accountsData } = useSocialAccounts();

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleGenerateText = useCallback(() => {
    if (!prompt.trim()) return;
    generateText.mutate({
      prompt,
      platforms: selectedPlatforms,
      variations: 3,
    });
  }, [prompt, selectedPlatforms, generateText]);

  const handleGenerateImages = useCallback(() => {
    if (!imagePrompt.trim()) return;
    generateImages.mutate({
      prompt: imagePrompt,
      style: selectedStyle,
      count: 4,
    });
  }, [imagePrompt, selectedStyle, generateImages]);

  const handleCopy = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleSaveDraft = useCallback(async (text: string, variationId: string) => {
    setSavedDraft(variationId);
    // In a full implementation, this would save to the backend
    // For now we show the UI feedback
    setTimeout(() => setSavedDraft(null), 2000);
  }, []);

  const textVariations = generateText.data?.data.variations || [];
  const suggestedHashtags = generateText.data?.data.suggestedHashtags || [
    "#AIMarketing", "#ContentCreation", "#SocialMedia", "#DigitalMarketing",
    "#GrowthHacking", "#MarketingTips", "#BrandStrategy", "#ContentStrategy",
  ];
  const generatedImages = generateImages.data?.data.images || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content Studio</h1>
        <p className="text-gray-500 dark:text-dark-muted mt-1">Create and generate AI-powered content for all platforms</p>
      </div>

      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="text" className="gap-2">
            <Type className="w-4 h-4" />
            Text
          </TabsTrigger>
          <TabsTrigger value="image" className="gap-2">
            <ImageIcon className="w-4 h-4" />
            Image
          </TabsTrigger>
          <TabsTrigger value="video" className="gap-2">
            <Video className="w-4 h-4" />
            Video
          </TabsTrigger>
        </TabsList>

        {/* TEXT TAB */}
        <TabsContent value="text">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Panel */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-brand-500" />
                    AI Prompt
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the content you want to generate... e.g., 'Write a motivational post about productivity for entrepreneurs'"
                    className="w-full h-32 p-3 rounded-md border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />

                  {/* Platform Selector with real-time char count */}
                  <div>
                    <p className="text-sm font-medium mb-2">Target Platforms</p>
                    <div className="flex flex-wrap gap-2">
                      {platforms.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => togglePlatform(p.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            selectedPlatforms.includes(p.id)
                              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400"
                              : "border-gray-200 dark:border-dark-border text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${p.color}`} />
                          {p.label}
                          {selectedPlatforms.includes(p.id) && (
                            <span className="text-[10px] text-gray-400">({p.maxChars})</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateText}
                    disabled={generateText.isPending || !prompt.trim() || selectedPlatforms.length === 0}
                    className="w-full"
                  >
                    {generateText.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    {generateText.isPending ? "Generating..." : "Generate 3 Variations"}
                  </Button>

                  {generateText.isError && (
                    <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/10 p-3 rounded-md">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{generateText.error?.message || "Failed to generate content. Please try again."}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Hashtag Suggestions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="w-4 h-4 text-brand-500" />
                    Suggested Hashtags
                    {generateText.data && (
                      <Badge variant="secondary" className="text-[10px]">AI Generated</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {suggestedHashtags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleCopy(tag, `tag-${tag}`)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-dark-surface-2 text-xs hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors group"
                      >
                        <span>{tag}</span>
                        {copiedId === `tag-${tag}` ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 text-brand-500 transition-opacity" />
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Generated Variations Panel */}
            <div className="space-y-4">
              {generateText.isPending && (
                <Card className="flex flex-col items-center justify-center p-12 text-center">
                  <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-4" />
                  <p className="text-gray-500 dark:text-dark-muted font-medium">Generating variations...</p>
                  <p className="text-sm text-gray-400 mt-1">AI is crafting content tailored to your platforms</p>
                </Card>
              )}

              {textVariations.length > 0
                ? textVariations.map((variation, i) => (
                    <Card key={variation.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="default">Variation {i + 1}</Badge>
                          <div className="flex items-center gap-2">
                            {variation.platforms.map((p) => (
                              <span
                                key={p.platform}
                                className={`text-xs ${
                                  p.withinLimit ? "text-gray-400" : "text-red-500 font-medium"
                                }`}
                              >
                                {p.charCount}/{p.maxChars}
                              </span>
                            ))}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-line mb-4">{variation.text}</p>

                        {/* Platform preview badges */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {variation.platforms.map((p) => {
                            const plat = platforms.find((pl) => pl.id === p.platform);
                            return (
                              <Badge
                                key={p.platform}
                                variant={p.withinLimit ? "secondary" : "destructive"}
                                className="text-[10px]"
                              >
                                <div className={`w-1.5 h-1.5 rounded-full ${plat?.color} mr-1`} />
                                {plat?.label}
                                {!p.withinLimit && " (over limit)"}
                              </Badge>
                            );
                          })}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleCopy(variation.text, variation.id)}
                          >
                            {copiedId === variation.id ? (
                              <Check className="w-3 h-3 mr-1 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3 mr-1" />
                            )}
                            {copiedId === variation.id ? "Copied!" : "Copy"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1"
                            onClick={() => handleSaveDraft(variation.text, variation.id)}
                          >
                            {savedDraft === variation.id ? (
                              <Check className="w-3 h-3 mr-1 text-green-500" />
                            ) : (
                              <Save className="w-3 h-3 mr-1" />
                            )}
                            {savedDraft === variation.id ? "Saved!" : "Save Draft"}
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            Schedule
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                : !generateText.isPending && (
                    <Card className="flex flex-col items-center justify-center p-12 text-center">
                      <Sparkles className="w-12 h-12 text-gray-300 dark:text-dark-border mb-4" />
                      <p className="text-gray-500 dark:text-dark-muted font-medium">No generated content yet</p>
                      <p className="text-sm text-gray-400 mt-1">Enter a prompt and click Generate to create variations</p>
                    </Card>
                  )}
            </div>
          </div>
        </TabsContent>

        {/* IMAGE TAB */}
        <TabsContent value="image">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-brand-500" />
                    Image Prompt
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Describe the image you want to generate... e.g., 'Modern flat illustration of team collaboration with brand colors'"
                    className="w-full h-32 p-3 rounded-md border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />

                  {/* Style Selector */}
                  <div>
                    <p className="text-sm font-medium mb-2">Style</p>
                    <div className="grid grid-cols-3 gap-2">
                      {imageStyles.map((style) => (
                        <button
                          key={style}
                          onClick={() => setSelectedStyle(style)}
                          className={`px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
                            selectedStyle === style
                              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600"
                              : "border-gray-200 dark:border-dark-border text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleGenerateImages}
                    disabled={generateImages.isPending || !imagePrompt.trim()}
                  >
                    {generateImages.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    {generateImages.isPending ? "Generating..." : "Generate 4 Images"}
                  </Button>

                  {generateImages.isError && (
                    <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/10 p-3 rounded-md">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>Failed to generate images. Please try again.</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Edit Tools */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Edit Tools</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm"><Crop className="w-4 h-4 mr-1" /> Crop</Button>
                    <Button variant="outline" size="sm"><Type className="w-4 h-4 mr-1" /> Text Overlay</Button>
                    <Button variant="outline" size="sm"><Palette className="w-4 h-4 mr-1" /> Brand Colors</Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Generated Image Grid */}
            <div className="grid grid-cols-2 gap-4">
              {generateImages.isPending ? (
                Array.from({ length: 4 }).map((_, n) => (
                  <Card key={n} className="aspect-square flex flex-col items-center justify-center text-center p-4">
                    <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-2" />
                    <p className="text-xs text-gray-400">Generating...</p>
                  </Card>
                ))
              ) : generatedImages.length > 0 ? (
                generatedImages.map((img) => (
                  <Card
                    key={img.id}
                    className="aspect-square flex flex-col items-center justify-center text-center p-4 hover:border-brand-500 transition-colors cursor-pointer relative overflow-hidden"
                  >
                    <div className="w-full h-full bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-900/20 dark:to-brand-800/20 rounded flex items-center justify-center">
                      <div className="text-center">
                        <ImageIcon className="w-8 h-8 text-brand-400 mx-auto mb-1" />
                        <p className="text-[10px] text-brand-500">{img.style}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-3">
                      <Button variant="ghost" size="sm" className="h-7 text-xs"><Download className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs"><Clock className="w-3 h-3" /></Button>
                    </div>
                  </Card>
                ))
              ) : (
                Array.from({ length: 4 }).map((_, n) => (
                  <Card key={n} className="aspect-square flex flex-col items-center justify-center text-center p-4 hover:border-brand-500 transition-colors cursor-pointer">
                    <ImageIcon className="w-10 h-10 text-gray-300 dark:text-dark-border mb-2" />
                    <p className="text-xs text-gray-400">Image {n + 1}</p>
                    <div className="flex gap-1 mt-3">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" disabled><Download className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" disabled><Clock className="w-3 h-3" /></Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* VIDEO TAB */}
        <TabsContent value="video">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Video className="w-4 h-4 text-brand-500" />
                    Video Generator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Video Type */}
                  <div>
                    <p className="text-sm font-medium mb-2">Video Type</p>
                    <div className="grid grid-cols-1 gap-2">
                      {videoTypes.map((vt) => (
                        <button
                          key={vt.id}
                          onClick={() => setVideoType(vt.id)}
                          className={`px-4 py-3 rounded-md text-sm font-medium border text-left transition-colors ${
                            videoType === vt.id
                              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600"
                              : "border-gray-200 dark:border-dark-border text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          {vt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    placeholder="Enter your video script or key points..."
                    className="w-full h-32 p-3 rounded-md border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />

                  <Button className="w-full">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Video
                  </Button>

                  {videoProgress > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Generating video...</span>
                        <span>{videoProgress}%</span>
                      </div>
                      <Progress value={videoProgress} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-dark-surface-2 flex items-center justify-center mb-4">
                <Play className="w-8 h-8 text-gray-400 ml-1" />
              </div>
              <p className="text-gray-500 dark:text-dark-muted font-medium">Video Preview</p>
              <p className="text-sm text-gray-400 mt-1">Generate a video to see preview here</p>
              <div className="flex gap-2 mt-6">
                <Button variant="outline" size="sm" disabled>Select Thumbnail</Button>
                <Button variant="outline" size="sm" disabled><Download className="w-3 h-3 mr-1" /> Download</Button>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
