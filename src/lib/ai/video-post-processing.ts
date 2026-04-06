import type { VideoAspectRatio } from './types';
import type { Platform } from '@/lib/social/types';

// ============================================
// Video Post-Processing Pipeline
// ============================================

export interface PlatformFormatSpec {
  platform: Platform;
  aspectRatio: VideoAspectRatio;
  width: number;
  height: number;
  maxDurationSeconds: number[];
  format: string;
  maxFileSizeMb: number;
}

export interface PostProcessingOptions {
  watermark?: {
    logoUrl: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    opacity: number; // 0-1
    scale: number; // relative to video width, e.g. 0.15
  };
  captions?: {
    text: string;
    style: 'burned-in' | 'srt';
    fontSize: number;
    fontColor: string;
    backgroundColor?: string;
    position: 'bottom' | 'center' | 'top';
  };
  trim?: {
    startSeconds: number;
    endSeconds: number;
  };
  thumbnailAtSeconds?: number;
}

export interface PostProcessedVideo {
  videoUrl: string;
  thumbnailUrl: string;
  srtUrl?: string;
  width: number;
  height: number;
  durationSeconds: number;
  format: string;
  fileSizeBytes?: number;
}

/**
 * Platform format specifications for video conversion.
 */
export const PLATFORM_FORMATS: Record<string, PlatformFormatSpec[]> = {
  tiktok: [
    { platform: 'tiktok', aspectRatio: '9:16', width: 1080, height: 1920, maxDurationSeconds: [15, 30, 60], format: 'mp4', maxFileSizeMb: 287 },
  ],
  instagram: [
    { platform: 'instagram', aspectRatio: '9:16', width: 1080, height: 1920, maxDurationSeconds: [15, 30, 60, 90], format: 'mp4', maxFileSizeMb: 250 },
    { platform: 'instagram', aspectRatio: '1:1', width: 1080, height: 1080, maxDurationSeconds: [60], format: 'mp4', maxFileSizeMb: 250 },
  ],
  youtube: [
    { platform: 'youtube', aspectRatio: '16:9', width: 1920, height: 1080, maxDurationSeconds: [15, 30, 60], format: 'mp4', maxFileSizeMb: 128000 },
    { platform: 'youtube', aspectRatio: '9:16', width: 1080, height: 1920, maxDurationSeconds: [15, 30, 60], format: 'mp4', maxFileSizeMb: 128000 },
  ],
  facebook: [
    { platform: 'facebook', aspectRatio: '16:9', width: 1920, height: 1080, maxDurationSeconds: [15, 30, 60], format: 'mp4', maxFileSizeMb: 4096 },
    { platform: 'facebook', aspectRatio: '1:1', width: 1080, height: 1080, maxDurationSeconds: [60], format: 'mp4', maxFileSizeMb: 4096 },
  ],
  linkedin: [
    { platform: 'linkedin', aspectRatio: '16:9', width: 1920, height: 1080, maxDurationSeconds: [15, 30], format: 'mp4', maxFileSizeMb: 5120 },
    { platform: 'linkedin', aspectRatio: '1:1', width: 1080, height: 1080, maxDurationSeconds: [30], format: 'mp4', maxFileSizeMb: 5120 },
  ],
  twitter: [
    { platform: 'twitter', aspectRatio: '16:9', width: 1920, height: 1080, maxDurationSeconds: [15, 30, 60], format: 'mp4', maxFileSizeMb: 512 },
  ],
  pinterest: [
    { platform: 'pinterest', aspectRatio: '9:16', width: 1080, height: 1920, maxDurationSeconds: [15, 30, 60], format: 'mp4', maxFileSizeMb: 2048 },
  ],
  threads: [
    { platform: 'threads', aspectRatio: '1:1', width: 1080, height: 1080, maxDurationSeconds: [60], format: 'mp4', maxFileSizeMb: 250 },
    { platform: 'threads', aspectRatio: '9:16', width: 1080, height: 1920, maxDurationSeconds: [60], format: 'mp4', maxFileSizeMb: 250 },
  ],
};

/**
 * Get the primary format spec for a platform.
 */
export function getPrimaryFormat(platform: Platform): PlatformFormatSpec {
  const specs = PLATFORM_FORMATS[platform];
  if (!specs || specs.length === 0) {
    return {
      platform,
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
      maxDurationSeconds: [60],
      format: 'mp4',
      maxFileSizeMb: 500,
    };
  }
  return specs[0];
}

/**
 * Get all supported format specs for a platform.
 */
export function getPlatformFormats(platform: Platform): PlatformFormatSpec[] {
  return PLATFORM_FORMATS[platform] || [getPrimaryFormat(platform)];
}

/**
 * Determine dimensions from aspect ratio.
 */
export function getDimensions(aspectRatio: VideoAspectRatio): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16': return { width: 1080, height: 1920 };
    case '16:9': return { width: 1920, height: 1080 };
    case '1:1': return { width: 1080, height: 1080 };
    default: return { width: 1920, height: 1080 };
  }
}

/**
 * Clamp duration to valid platform durations.
 */
export function clampDuration(platform: Platform, requestedSeconds: number): number {
  const spec = getPrimaryFormat(platform);
  const maxDurations = spec.maxDurationSeconds;
  const maxAllowed = Math.max(...maxDurations);
  return Math.min(Math.max(requestedSeconds, 5), maxAllowed);
}

/**
 * Get available duration options for a platform.
 */
export function getAvailableDurations(platform: Platform): number[] {
  const spec = getPrimaryFormat(platform);
  return spec.maxDurationSeconds;
}

/**
 * Generate the post-processing configuration for a video.
 * This produces the job spec that a media processing service (e.g., FFmpeg worker) would consume.
 */
export function buildPostProcessingSpec(params: {
  sourceVideoUrl: string;
  platform: Platform;
  aspectRatio: VideoAspectRatio;
  durationSeconds: number;
  options?: PostProcessingOptions;
}): {
  input: string;
  output: {
    format: string;
    width: number;
    height: number;
    durationSeconds: number;
  };
  operations: string[];
  watermark?: PostProcessingOptions['watermark'];
  captions?: PostProcessingOptions['captions'];
  trim?: PostProcessingOptions['trim'];
  thumbnailAtSeconds: number;
} {
  const dims = getDimensions(params.aspectRatio);
  const duration = clampDuration(params.platform, params.durationSeconds);
  const operations: string[] = [];

  // Always resize/reformat
  operations.push(`resize:${dims.width}x${dims.height}`);
  operations.push('encode:h264_aac_mp4');

  if (params.options?.trim) {
    operations.push(`trim:${params.options.trim.startSeconds}-${params.options.trim.endSeconds}`);
  }

  if (params.options?.watermark) {
    operations.push(`watermark:${params.options.watermark.position}`);
  }

  if (params.options?.captions?.style === 'burned-in') {
    operations.push('burn_captions');
  }

  return {
    input: params.sourceVideoUrl,
    output: {
      format: 'mp4',
      width: dims.width,
      height: dims.height,
      durationSeconds: duration,
    },
    operations,
    watermark: params.options?.watermark,
    captions: params.options?.captions,
    trim: params.options?.trim,
    thumbnailAtSeconds: params.options?.thumbnailAtSeconds ?? Math.min(2, duration),
  };
}

/**
 * Generate SRT subtitle content from caption text.
 */
export function generateSrt(
  text: string,
  durationSeconds: number,
  wordsPerSegment: number = 8
): string {
  const words = text.split(/\s+/);
  const segments: string[] = [];
  const segmentCount = Math.ceil(words.length / wordsPerSegment);
  const segmentDuration = durationSeconds / segmentCount;

  for (let i = 0; i < segmentCount; i++) {
    const start = i * segmentDuration;
    const end = Math.min((i + 1) * segmentDuration, durationSeconds);
    const segmentWords = words.slice(i * wordsPerSegment, (i + 1) * wordsPerSegment).join(' ');

    segments.push(
      `${i + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${segmentWords}\n`
    );
  }

  return segments.join('\n');
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad3(ms)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function pad3(n: number): string {
  return n.toString().padStart(3, '0');
}

/**
 * Get platforms that should receive variant conversions from a source video.
 * Given a source platform, returns the list of all other platform format specs
 * that the video could be converted to.
 */
export function getBatchVariantTargets(
  sourcePlatform: Platform,
  sourceAspectRatio: VideoAspectRatio
): Array<{ platform: Platform; aspectRatio: VideoAspectRatio }> {
  const allPlatforms = Object.keys(PLATFORM_FORMATS) as Platform[];
  const targets: Array<{ platform: Platform; aspectRatio: VideoAspectRatio }> = [];

  for (const platform of allPlatforms) {
    if (platform === sourcePlatform) continue;
    const specs = PLATFORM_FORMATS[platform];
    if (!specs) continue;

    // Pick the spec closest to the source aspect ratio, or the primary one
    const matchingSpec = specs.find((s) => s.aspectRatio === sourceAspectRatio) || specs[0];
    targets.push({ platform, aspectRatio: matchingSpec.aspectRatio });
  }

  return targets;
}
