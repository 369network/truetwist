export type TrendSource = 'youtube' | 'google_trends' | 'twitter' | 'tiktok' | 'instagram' | 'manual';
export type TrendLifecycle = 'emerging' | 'rising' | 'peaking' | 'declining' | 'expired';
export type CompetitionLevel = 'low' | 'medium' | 'high' | 'saturated';
export type TrendDirection = 'rising' | 'stable' | 'declining';
export type TrendAlertType = 'trend_emerging' | 'trend_peaking' | 'niche_match' | 'hashtag_trending';
export type DigestFrequency = 'realtime' | 'daily' | 'weekly';

export interface NormalizedTrend {
  title: string;
  platform: string;
  source: TrendSource;
  category: string | null;
  description: string | null;
  exampleUrls: string[];
  engagementMetrics: Record<string, number>;
  velocity: number;
  sentiment: number;
  region: string;
  rawPayload: Record<string, unknown>;
  hashtags: string[];
}

export interface TrendCollectionResult {
  source: TrendSource;
  region: string;
  trendsFound: number;
  trendsUpdated: number;
  errors: string[];
}

export interface ViralScoreInput {
  engagements: number;
  followers: number;
  hours: number;
  acceleration: number;
  shareRatio: number;
  nonFollowerReach: number;
  reachHours: number;
  platform: string;
  contentFormat: string;
  sentimentScore: number;
  peakVelocity: number;
  currentVelocity: number;
  ageHours: number;
}

export interface ViralScoreResult {
  score: number; // 0-100
  velocity: number;
  acceleration: number;
  lifecycle: TrendLifecycle;
  components: {
    engagementVelocity: number;
    engagementAcceleration: number;
    shareComponent: number;
    reachVelocity: number;
    formatMultiplier: number;
    sentimentWeight: number;
    timeDecay: number;
  };
}

export interface HashtagRecommendation {
  tag: string;
  platform: string;
  reach: number;
  competitionLevel: CompetitionLevel;
  trendDirection: TrendDirection;
  relevanceScore: number;
  isBanned: boolean;
}

export interface HashtagAnalysisResult {
  recommended: HashtagRecommendation[];
  trending: HashtagRecommendation[];
  niche: HashtagRecommendation[];
  banned: string[];
}

export interface TrendCollectionJobData {
  source: TrendSource;
  region: string;
  jobDbId: string; // TrendCollectionJob.id
}

export interface TrendDigest {
  userId: string;
  period: string;
  topTrends: Array<{
    title: string;
    platform: string;
    viralScore: number;
    lifecycle: TrendLifecycle;
  }>;
  nicheMatches: Array<{
    title: string;
    matchedKeyword: string;
    viralScore: number;
  }>;
  hashtagInsights: Array<{
    tag: string;
    direction: TrendDirection;
    reach: number;
  }>;
  generatedAt: Date;
}

// Platform-specific viral thresholds (engagement rate % for first N hours)
export const VIRAL_THRESHOLDS: Record<string, Record<string, number>> = {
  twitter: { micro: 10, mid: 6, macro: 3, mega: 1.5 },
  tiktok: { micro: 30, mid: 25, macro: 18, mega: 10 },
  instagram: { micro: 15, mid: 10, macro: 6, mega: 4 },
  youtube: { micro: 50, mid: 20, macro: 10, mega: 5 }, // multiplier of subs
  linkedin: { micro: 12, mid: 8, macro: 5, mega: 3 },
  facebook: { micro: 10, mid: 6, macro: 3, mega: 1.5 },
  threads: { micro: 12, mid: 8, macro: 5, mega: 3 },
};

// Content format multipliers per platform
export const FORMAT_MULTIPLIERS: Record<string, Record<string, number>> = {
  twitter: { quote_tweet: 1.8, thread: 1.5, poll: 1.3, text: 1.0, image: 1.2, video: 1.4 },
  tiktok: { duet: 1.8, stitch: 1.8, short_video: 2.0, long_video: 1.0 },
  instagram: { reels_short: 2.0, reels_long: 1.5, carousel: 1.6, story: 1.2, image: 1.0, video: 1.3 },
  youtube: { shorts: 1.8, video: 1.0, live: 1.5, community: 0.8 },
  linkedin: { article: 1.5, carousel: 1.6, poll: 1.4, text: 1.0, video: 1.3, image: 1.1 },
};

// Time-decay half-lives per platform (in hours)
export const HALF_LIVES: Record<string, number> = {
  twitter: 7,
  tiktok: 23,
  instagram: 14,
  youtube: 139, // ~5.8 days
  linkedin: 48,
  facebook: 24,
  threads: 12,
};
