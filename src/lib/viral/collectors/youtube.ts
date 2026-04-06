import type { NormalizedTrend } from '../types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface YouTubeTrendingVideo {
  id: string;
  snippet: {
    title: string;
    description: string;
    categoryId: string;
    tags?: string[];
    publishedAt: string;
    channelTitle: string;
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
  contentDetails: {
    duration: string;
  };
}

interface YouTubeApiResponse {
  items: YouTubeTrendingVideo[];
  nextPageToken?: string;
  pageInfo: { totalResults: number; resultsPerPage: number };
}

const CATEGORY_MAP: Record<string, string> = {
  '1': 'Film & Animation', '2': 'Autos & Vehicles', '10': 'Music',
  '15': 'Pets & Animals', '17': 'Sports', '19': 'Travel & Events',
  '20': 'Gaming', '22': 'People & Blogs', '23': 'Comedy',
  '24': 'Entertainment', '25': 'News & Politics', '26': 'Howto & Style',
  '27': 'Education', '28': 'Science & Technology',
};

/**
 * Fetches trending videos from YouTube Data API v3.
 * Free tier: 10,000 quota units/day (1 unit per videos.list call).
 * Returns up to 200 most popular videos per region.
 */
export async function fetchYouTubeTrends(region: string = 'US'): Promise<NormalizedTrend[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const trends: NormalizedTrend[] = [];
  let pageToken: string | undefined;

  // Fetch up to 2 pages (100 videos)
  for (let page = 0; page < 2; page++) {
    const params = new URLSearchParams({
      part: 'snippet,statistics,contentDetails',
      chart: 'mostPopular',
      regionCode: region,
      maxResults: '50',
      key: apiKey,
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube API error ${response.status}: ${errorText}`);
    }

    const data: YouTubeApiResponse = await response.json();

    for (const video of data.items) {
      const views = parseInt(video.statistics.viewCount || '0', 10);
      const likes = parseInt(video.statistics.likeCount || '0', 10);
      const comments = parseInt(video.statistics.commentCount || '0', 10);

      const publishedAt = new Date(video.snippet.publishedAt);
      const hoursAgo = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
      const velocity = hoursAgo > 0 ? views / hoursAgo : 0;

      trends.push({
        title: video.snippet.title,
        platform: 'youtube',
        source: 'youtube',
        category: CATEGORY_MAP[video.snippet.categoryId] || 'Other',
        description: video.snippet.description.slice(0, 500),
        exampleUrls: [`https://youtube.com/watch?v=${video.id}`],
        engagementMetrics: { views, likes, comments },
        velocity,
        sentiment: 0, // Computed separately via NLP
        region,
        rawPayload: video as unknown as Record<string, unknown>,
        hashtags: extractHashtags(video.snippet.tags, video.snippet.title),
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return trends;
}

function extractHashtags(tags?: string[], title?: string): string[] {
  const hashtagSet = new Set<string>();

  if (tags) {
    for (const tag of tags.slice(0, 15)) {
      hashtagSet.add(tag.toLowerCase().replace(/\s+/g, ''));
    }
  }

  if (title) {
    const matches = title.match(/#\w+/g);
    if (matches) {
      for (const match of matches) {
        hashtagSet.add(match.slice(1).toLowerCase());
      }
    }
  }

  return Array.from(hashtagSet);
}
