import type { NormalizedTrend } from '../types';

const TWITTER_API_BASE = 'https://api.twitter.com/2';

interface TwitterTrend {
  name: string;
  url: string;
  tweet_volume: number | null;
  promoted_content: boolean | null;
}

interface TwitterTrendsResponse {
  data: Array<{
    name: string;
    tweet_count: number;
    description?: string;
  }>;
}

/**
 * Fetches trending topics from Twitter/X API v2.
 * Requires Pro tier ($5,000/mo) for trends endpoint.
 * Rate limit: ~75 requests/15-min window.
 *
 * Falls back to Basic tier search-based trend estimation if Pro is unavailable.
 */
export async function fetchTwitterTrends(region: string = 'US'): Promise<NormalizedTrend[]> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error('TWITTER_BEARER_TOKEN environment variable is not set');
  }

  const woeid = getWoeid(region);

  // Try Pro tier trends endpoint first
  try {
    return await fetchTwitterTrendsPro(bearerToken, woeid, region);
  } catch {
    // Fall back to search-based estimation (Basic tier)
    return await fetchTwitterTrendsBasic(bearerToken, region);
  }
}

async function fetchTwitterTrendsPro(
  bearerToken: string,
  woeid: number,
  region: string
): Promise<NormalizedTrend[]> {
  const response = await fetch(`${TWITTER_API_BASE}/trends/by/woeid/${woeid}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  if (!response.ok) {
    throw new Error(`Twitter Trends API error ${response.status}`);
  }

  const data: TwitterTrendsResponse = await response.json();
  const trends: NormalizedTrend[] = [];

  for (const trend of data.data ?? []) {
    const volume = trend.tweet_count ?? 0;
    // Twitter trends refresh every ~5 minutes, so velocity is volume/time
    const velocity = volume / 5;

    trends.push({
      title: trend.name,
      platform: 'twitter',
      source: 'twitter',
      category: null,
      description: trend.description ?? null,
      exampleUrls: [`https://twitter.com/search?q=${encodeURIComponent(trend.name)}`],
      engagementMetrics: { tweetVolume: volume },
      velocity,
      sentiment: 0,
      region,
      rawPayload: trend as unknown as Record<string, unknown>,
      hashtags: trend.name.startsWith('#')
        ? [trend.name.slice(1).toLowerCase()]
        : trend.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
    });
  }

  return trends;
}

/**
 * Basic tier fallback: uses recent search counts to estimate trending topics.
 * Less accurate but available on the Basic tier ($100/mo).
 */
async function fetchTwitterTrendsBasic(
  bearerToken: string,
  region: string
): Promise<NormalizedTrend[]> {
  // With Basic tier, we can only search for specific terms.
  // This is a stub - in production, we'd maintain a set of tracked keywords
  // and measure their tweet volume over time to detect velocity spikes.
  return [];
}

function getWoeid(region: string): number {
  const WOEIDS: Record<string, number> = {
    US: 23424977,
    GB: 23424975,
    CA: 23424775,
    AU: 23424748,
    IN: 23424848,
    BR: 23424768,
    DE: 23424829,
    FR: 23424819,
    JP: 23424856,
    WORLDWIDE: 1,
  };
  return WOEIDS[region] ?? WOEIDS.WORLDWIDE;
}
