import type { NormalizedTrend } from '../types';

const SERPAPI_BASE = 'https://serpapi.com/search.json';

interface GoogleTrendResult {
  title: string;
  description?: string;
  traffic?: string; // e.g. "500K+"
  relatedQueries?: string[];
  articles?: Array<{ title: string; url: string }>;
}

interface SerpApiTrendsResponse {
  trending_searches?: Array<{
    query: string;
    traffic: string;
    related_queries?: Array<{ query: string }>;
    articles?: Array<{ title: string; link: string; source: string }>;
  }>;
  interest_over_time?: Array<{
    query: string;
    value: number[];
    date: string;
  }>;
}

/**
 * Fetches daily trending searches from Google Trends via SerpApi.
 * SerpApi: $50-130/mo, stable and reliable.
 * Falls back to free pytrends-style endpoint if SERPAPI_KEY is not set.
 */
export async function fetchGoogleTrends(region: string = 'US'): Promise<NormalizedTrend[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return fetchGoogleTrendsFallback(region);
  }

  const params = new URLSearchParams({
    engine: 'google_trends_trending_now',
    geo: region,
    api_key: apiKey,
  });

  const response = await fetch(`${SERPAPI_BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`SerpApi error ${response.status}: ${await response.text()}`);
  }

  const data: SerpApiTrendsResponse = await response.json();
  const trends: NormalizedTrend[] = [];

  for (const item of data.trending_searches ?? []) {
    const volume = parseTrafficVolume(item.traffic);
    const velocity = volume / 24; // rough hourly velocity

    trends.push({
      title: item.query,
      platform: 'google',
      source: 'google_trends',
      category: null,
      description: item.articles?.[0]?.title ?? null,
      exampleUrls: item.articles?.map((a) => a.link).slice(0, 3) ?? [],
      engagementMetrics: { searchVolume: volume },
      velocity,
      sentiment: 0,
      region,
      rawPayload: item as unknown as Record<string, unknown>,
      hashtags: extractKeywords(item.query, item.related_queries),
    });
  }

  return trends;
}

/**
 * Fallback: free Google Trends endpoint (unofficial, rate-limited).
 * Returns fewer results and less reliable data.
 */
async function fetchGoogleTrendsFallback(region: string): Promise<NormalizedTrend[]> {
  const url = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${region}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'TrueTwist/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Google Trends RSS error ${response.status}`);
  }

  const xml = await response.text();
  return parseGoogleTrendsRss(xml, region);
}

function parseGoogleTrendsRss(xml: string, region: string): NormalizedTrend[] {
  const trends: NormalizedTrend[] = [];
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

  for (const item of items.slice(0, 20)) {
    const title = extractXmlTag(item, 'title') ?? '';
    const traffic = extractXmlTag(item, 'ht:approx_traffic') ?? '0';
    const newsUrl = extractXmlTag(item, 'ht:news_item_url') ?? '';

    const volume = parseTrafficVolume(traffic);

    trends.push({
      title,
      platform: 'google',
      source: 'google_trends',
      category: null,
      description: null,
      exampleUrls: newsUrl ? [newsUrl] : [],
      engagementMetrics: { searchVolume: volume },
      velocity: volume / 24,
      sentiment: 0,
      region,
      rawPayload: { title, traffic, newsUrl },
      hashtags: title.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
    });
  }

  return trends;
}

function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1]?.trim() ?? null;
}

function parseTrafficVolume(traffic: string): number {
  if (!traffic) return 0;
  const cleaned = traffic.replace(/[^0-9KMB+.]/gi, '').toUpperCase();
  const num = parseFloat(cleaned);
  if (cleaned.includes('B')) return num * 1_000_000_000;
  if (cleaned.includes('M')) return num * 1_000_000;
  if (cleaned.includes('K')) return num * 1_000;
  return num || 0;
}

function extractKeywords(
  query: string,
  relatedQueries?: Array<{ query: string }>
): string[] {
  const keywords = new Set<string>();
  for (const word of query.toLowerCase().split(/\s+/)) {
    if (word.length > 2) keywords.add(word);
  }
  if (relatedQueries) {
    for (const rq of relatedQueries.slice(0, 5)) {
      for (const word of rq.query.toLowerCase().split(/\s+/)) {
        if (word.length > 2) keywords.add(word);
      }
    }
  }
  return Array.from(keywords);
}
