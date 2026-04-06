import type { Platform } from '@/lib/social/types';

export interface CompetitorCollectionResult {
  accountId: string;
  platform: Platform;
  handle: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  newPosts: number;
  updatedPosts: number;
}

export interface CompetitorBenchmark {
  metric: string;
  userValue: number;
  competitorAvg: number;
  competitorBest: number;
  competitorBestName: string;
  percentile: number; // where user stands (0-100)
}

export interface ContentGap {
  contentType: string;
  competitorUsagePercent: number;
  userUsagePercent: number;
  gap: number; // positive = competitors use more
  topCompetitors: string[];
}

export interface CompetitiveComparison {
  userId: string;
  businessId: string;
  period: string;
  benchmarks: CompetitorBenchmark[];
  contentGaps: ContentGap[];
  postingFrequencyComparison: {
    user: number;
    competitorAvg: number;
    competitorBest: { name: string; frequency: number };
  };
}

export interface IntelligenceReport {
  businessId: string;
  generatedAt: Date;
  period: string;
  summary: string;
  keyFindings: string[];
  competitorHighlights: Array<{
    competitorName: string;
    followerGrowth: number;
    engagementTrend: 'up' | 'down' | 'stable';
    topPost: { text: string; engagement: number } | null;
    strategyNotes: string[];
  }>;
  recommendations: string[];
  contentGaps: ContentGap[];
}

export type AlertType = 'viral_post' | 'strategy_change' | 'follower_spike' | 'new_competitor';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface CollectionJobData {
  competitorAccountId: string;
  competitorId: string;
  businessId: string;
  platform: string;
  handle: string;
}
