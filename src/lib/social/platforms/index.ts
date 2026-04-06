import type { Platform } from "../types";
import { PlatformAdapter } from "../platform-adapter";
import { InstagramAdapter } from "./instagram";
import { FacebookAdapter } from "./facebook";
import { TwitterAdapter } from "./twitter";
import { LinkedInAdapter } from "./linkedin";
import { TikTokAdapter } from "./tiktok";
import { YouTubeAdapter } from "./youtube";
import { PinterestAdapter } from "./pinterest";
import { ThreadsAdapter } from "./threads";

const adapters: Record<Platform, PlatformAdapter> = {
  instagram: new InstagramAdapter(),
  facebook: new FacebookAdapter(),
  twitter: new TwitterAdapter(),
  linkedin: new LinkedInAdapter(),
  tiktok: new TikTokAdapter(),
  youtube: new YouTubeAdapter(),
  pinterest: new PinterestAdapter(),
  threads: new ThreadsAdapter(),
};

/**
 * Returns the adapter for a given platform.
 * Throws if the platform is not recognized.
 */
export function getPlatformAdapter(platform: Platform): PlatformAdapter {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new Error(
      `Platform "${platform}" is not supported. Available: ${Object.keys(adapters).join(", ")}`
    );
  }
  return adapter;
}

/**
 * Returns all currently registered platform adapters.
 */
export function getAllAdapters(): PlatformAdapter[] {
  return Object.values(adapters);
}

/**
 * Checks if a platform has an adapter implemented.
 */
export function isPlatformSupported(platform: Platform): boolean {
  return platform in adapters;
}
