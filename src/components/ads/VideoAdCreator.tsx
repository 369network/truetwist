"use client";

import { useState, useEffect, useCallback } from "react";
import { Video, Loader2, CheckCircle, AlertCircle, Link, Play } from "lucide-react";

interface VideoAdCreatorProps {
  businessId: string;
  platform?: string;
  onVideoCreated?: (videoUrl: string, thumbnailUrl: string) => void;
}

type JobStatus = "idle" | "submitting" | "pending" | "processing" | "completed" | "failed";

export default function VideoAdCreator({
  businessId,
  platform = "facebook",
  onVideoCreated,
}: VideoAdCreatorProps) {
  const [url, setUrl] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("16:9");
  const [style, setStyle] = useState("professional");
  const [voiceover, setVoiceover] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!url) return;
    setStatus("submitting");
    setError(null);

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/v1/ai/generate/video-ad", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          businessId,
          url,
          platform,
          aspectRatio,
          style,
          voiceover,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || "Failed to start video generation");
      }

      const data = await res.json();
      setJobId(data.data.jobId);
      setStatus("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start video generation");
      setStatus("failed");
    }
  };

  const pollStatus = useCallback(async () => {
    if (!jobId) return;

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/api/v1/ai/generate/video-ad/${jobId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) return;

      const data = await res.json();
      const jobStatus = data.data.status;

      if (jobStatus === "completed") {
        setStatus("completed");
        setVideoUrl(data.data.videoUrl);
        setThumbnailUrl(data.data.thumbnailUrl);
        onVideoCreated?.(data.data.videoUrl, data.data.thumbnailUrl);
      } else if (jobStatus === "failed") {
        setStatus("failed");
        setError(data.data.error || "Video generation failed");
      } else {
        setStatus(jobStatus === "processing" ? "processing" : "pending");
      }
    } catch {
      // Silently retry on network errors
    }
  }, [jobId, onVideoCreated]);

  useEffect(() => {
    if (status !== "pending" && status !== "processing") return;
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [status, pollStatus]);

  const isGenerating = status === "submitting" || status === "pending" || status === "processing";

  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Video className="w-5 h-5 text-brand-500" />
        <h3 className="font-semibold text-lg">AI Video Ad Creator</h3>
      </div>

      <p className="text-sm text-gray-500 dark:text-dark-muted mb-4">
        Enter a product or landing page URL to generate a professional video ad with AI.
      </p>

      {/* URL Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Product URL</label>
        <div className="relative">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourproduct.com/landing-page"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
            disabled={isGenerating}
          />
        </div>
      </div>

      {/* Options Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Aspect Ratio</label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as "9:16" | "16:9" | "1:1")}
            className="w-full py-2 px-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            disabled={isGenerating}
          >
            <option value="16:9">Landscape (16:9)</option>
            <option value="9:16">Portrait (9:16)</option>
            <option value="1:1">Square (1:1)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Style</label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full py-2 px-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            disabled={isGenerating}
          >
            <option value="professional">Professional</option>
            <option value="dynamic">Dynamic</option>
            <option value="minimal">Minimal</option>
            <option value="bold">Bold</option>
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={voiceover}
              onChange={(e) => setVoiceover(e.target.checked)}
              className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              disabled={isGenerating}
            />
            <span className="text-sm">Voiceover</span>
          </label>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleSubmit}
        disabled={!url || isGenerating}
        className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {status === "submitting"
              ? "Starting..."
              : status === "processing"
                ? "Rendering video..."
                : "Waiting in queue..."}
          </>
        ) : (
          <>
            <Video className="w-4 h-4" />
            Generate Video Ad
          </>
        )}
      </button>

      {/* Status / Result */}
      {status === "completed" && videoUrl && (
        <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Video ready!
            </span>
          </div>
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
            )}
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
            >
              <Play className="w-12 h-12 text-white" />
            </a>
          </div>
        </div>
      )}

      {status === "failed" && error && (
        <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
