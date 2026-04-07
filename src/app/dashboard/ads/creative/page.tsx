"use client";
import { useState } from "react";
import Link from "next/link";
import { useGenerateText, useGenerateImages } from "@/hooks/use-api";

const AD_PLATFORMS = [
  { id: "meta", label: "Meta", color: "#1877F2" },
  { id: "google", label: "Google", color: "#4285F4" },
  { id: "tiktok", label: "TikTok", color: "#ff0050" },
];

const AD_TYPES = [
  { id: "copy", label: "Ad Copy", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
  { id: "image", label: "Image Ad", icon: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v13.5a2.25 2.25 0 002.25 2.25z" },
];

export default function AdCreativePage() {
  const [activeType, setActiveType] = useState("copy");
  const [prompt, setPrompt] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["meta"]);
  const [variations, setVariations] = useState(3);
  const [generatedCopy, setGeneratedCopy] = useState<Array<{ id: string; text: string }>>([]);
  const [generatedImages, setGeneratedImages] = useState<Array<{ id: string; url: string; thumbnailUrl: string }>>([]);

  const generateText = useGenerateText();
  const generateImages = useGenerateImages();

  const handleGenerateCopy = async () => {
    if (!prompt.trim()) return;
    const result = await generateText.mutateAsync({
      prompt: `Create ad copy: ${prompt}`,
      platforms: selectedPlatforms,
      variations,
    });
    setGeneratedCopy(result.data.variations);
  };

  const handleGenerateImages = async () => {
    if (!prompt.trim()) return;
    const result = await generateImages.mutateAsync({
      prompt: `Ad creative: ${prompt}`,
      count: variations,
    });
    setGeneratedImages(result.data.images);
  };

  const isGenerating = generateText.isPending || generateImages.isPending;

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/ads" className="text-xs flex items-center gap-1 mb-3" style={{ color: "var(--tt-text-muted)" }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Ad Performance
        </Link>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--tt-text)" }}>
          Creative Studio
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--tt-text-muted)" }}>
          AI-powered ad copy and creative generation
        </p>
      </div>

      {/* Type Selector */}
      <div className="flex gap-3">
        {AD_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => setActiveType(type.id)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all"
            style={{
              background: activeType === type.id ? "rgba(99,102,241,0.15)" : "var(--tt-surface)",
              color: activeType === type.id ? "#a5b4fc" : "var(--tt-text-muted)",
              border: `1px solid ${activeType === type.id ? "rgba(99,102,241,0.3)" : "var(--tt-border)"}`,
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={type.icon} />
            </svg>
            {type.label}
          </button>
        ))}
      </div>

      {/* Generation Form */}
      <div
        className="p-5 rounded-xl"
        style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
      >
        <div className="space-y-4">
          {/* Prompt */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--tt-text-muted)" }}>
              {activeType === "copy" ? "What should the ad promote?" : "Describe the image you want"}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={activeType === "copy"
                ? "e.g., Summer sale on running shoes, 40% off, free shipping..."
                : "e.g., Modern sneaker on a white background with dynamic lighting..."
              }
              className="w-full px-4 py-3 rounded-xl text-sm resize-none"
              rows={3}
              style={{
                background: "var(--tt-surface-2)",
                border: "1px solid var(--tt-border)",
                color: "var(--tt-text)",
                outline: "none",
              }}
            />
          </div>

          {/* Platform Selection */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--tt-text-muted)" }}>
              Target Platforms
            </label>
            <div className="flex gap-2">
              {AD_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: selectedPlatforms.includes(p.id) ? `${p.color}20` : "transparent",
                    color: selectedPlatforms.includes(p.id) ? p.color : "var(--tt-text-muted)",
                    border: `1px solid ${selectedPlatforms.includes(p.id) ? `${p.color}40` : "var(--tt-border)"}`,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Variations */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--tt-text-muted)" }}>
              Variations
            </label>
            <div className="flex gap-2">
              {[1, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setVariations(n)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: variations === n ? "rgba(99,102,241,0.15)" : "transparent",
                    color: variations === n ? "#a5b4fc" : "var(--tt-text-muted)",
                    border: `1px solid ${variations === n ? "rgba(99,102,241,0.3)" : "var(--tt-border)"}`,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={activeType === "copy" ? handleGenerateCopy : handleGenerateImages}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Generate {activeType === "copy" ? "Ad Copy" : "Images"}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Generated Copy Results */}
      {generatedCopy.length > 0 && activeType === "copy" && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--tt-text)" }}>Generated Ad Copy</h3>
          {generatedCopy.map((variation, i) => (
            <div
              key={variation.id}
              className="p-4 rounded-xl"
              style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: "#a5b4fc" }}>Variation {i + 1}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(variation.text)}
                  className="text-xs px-2 py-1 rounded-lg transition-all hover:bg-white/5"
                  style={{ color: "var(--tt-text-muted)" }}
                >
                  Copy
                </button>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--tt-text)" }}>{variation.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Generated Image Results */}
      {generatedImages.length > 0 && activeType === "image" && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--tt-text)" }}>Generated Images</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {generatedImages.map((img, i) => (
              <div
                key={img.id}
                className="rounded-xl overflow-hidden"
                style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
              >
                <div className="aspect-square bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
                  <img src={img.thumbnailUrl || img.url} alt={`Generated ad ${i + 1}`} className="w-full h-full object-cover" />
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Image {i + 1}</span>
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs"
                    style={{ color: "#818cf8" }}
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
