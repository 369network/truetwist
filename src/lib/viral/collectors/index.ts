import type { NormalizedTrend, TrendSource } from '../types';
import { fetchYouTubeTrends } from './youtube';
import { fetchGoogleTrends } from './google-trends';
import { fetchTwitterTrends } from './twitter';

type TrendCollector = (region: string) => Promise<NormalizedTrend[]>;

const COLLECTORS: Record<string, TrendCollector> = {
  youtube: fetchYouTubeTrends,
  google_trends: fetchGoogleTrends,
  twitter: fetchTwitterTrends,
};

/**
 * Fetches trends from a specific source.
 * Returns normalized trend data regardless of the source.
 */
export async function collectTrends(
  source: TrendSource,
  region: string = 'US'
): Promise<NormalizedTrend[]> {
  const collector = COLLECTORS[source];
  if (!collector) {
    throw new Error(`No collector available for source: ${source}`);
  }
  return collector(region);
}

/**
 * Returns the list of available (configured) trend sources.
 */
export function getAvailableSources(): TrendSource[] {
  const sources: TrendSource[] = [];
  if (process.env.YOUTUBE_API_KEY) sources.push('youtube');
  if (process.env.SERPAPI_KEY || true) sources.push('google_trends'); // RSS fallback always available
  if (process.env.TWITTER_BEARER_TOKEN) sources.push('twitter');
  return sources;
}
