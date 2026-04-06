import type { Platform } from '@/lib/social/types';
import type { ContentTemplate } from '@/lib/ai/types';

// ============================================
// Content Suggestions
// ============================================

export interface ContentSuggestion {
  title: string;
  description: string;
  contentType: 'text' | 'image' | 'video' | 'carousel';
  template: ContentTemplate;
  platforms: Platform[];
  hashtags: string[];
  optimalPostTime?: Date;
  confidence: number; // 0-1, how confident the engine is in this suggestion
  source: 'performance' | 'trending' | 'competitor' | 'seasonal' | 'gap';
}

export interface ContentSuggestionRequest {
  userId: string;
  businessId: string;
  platforms?: Platform[];
  count?: number; // default 5
  includeCompetitorInspired?: boolean;
  includeSeasonal?: boolean;
}

export interface FillMyWeekRequest {
  userId: string;
  businessId: string;
  socialAccountIds: string[];
  startDate?: Date; // defaults to next Monday
  timezone: string;
  postsPerDay?: number; // default 2
}

export interface FillMyWeekSlot {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  date: string; // ISO date
  scheduledAt: Date;
  platform: Platform;
  socialAccountId: string;
  suggestion: ContentSuggestion;
}

export interface FillMyWeekResult {
  weekStart: string;
  weekEnd: string;
  slots: FillMyWeekSlot[];
  totalSuggestions: number;
}

// ============================================
// Smart Recommendations
// ============================================

export interface BestTimeRecommendation {
  platform: Platform;
  socialAccountId: string;
  slots: Array<{
    dayOfWeek: number;
    hourUtc: number;
    score: number;
    label: string; // e.g. "Monday 10:00 AM"
  }>;
  dataQuality: 'high' | 'medium' | 'low'; // based on sample size
}

export interface PostingFrequencyRecommendation {
  platform: Platform;
  currentFrequency: number; // posts per week
  recommendedFrequency: number;
  competitorAvgFrequency: number;
  reasoning: string;
}

export interface ContentMixRecommendation {
  currentMix: Record<string, number>; // content type -> percentage
  recommendedMix: Record<string, number>;
  competitorAvgMix: Record<string, number>;
  gaps: Array<{
    contentType: string;
    currentPercent: number;
    recommendedPercent: number;
    reason: string;
  }>;
}

export interface HashtagStrategyRecommendation {
  consistentHashtags: string[]; // always use these
  rotatingHashtags: string[][]; // rotate between these groups
  trendingHashtags: string[]; // currently trending
  avoidHashtags: string[]; // overused or declining
  optimalCount: number; // suggested number per post
  platform: Platform;
}

export type AccountStage = 'new' | 'growing' | 'established';

export interface GrowthTacticRecommendation {
  accountStage: AccountStage;
  tactics: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: 'content' | 'engagement' | 'consistency' | 'collaboration' | 'optimization';
    estimatedImpact: string;
  }>;
  platform: Platform;
}

// ============================================
// Performance Insights
// ============================================

export interface WeeklyInsights {
  userId: string;
  businessId: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  whatWorked: Array<{
    pattern: string;
    evidence: string;
    postsCount: number;
  }>;
  whatToTryNextWeek: Array<{
    suggestion: string;
    reasoning: string;
  }>;
  anomalies: Array<{
    type: 'spike' | 'drop';
    metric: string;
    platform: Platform;
    change: number; // percentage change
    explanation: string;
  }>;
  topPerformingPosts: Array<{
    postId: string;
    platform: Platform;
    engagementScore: number;
    contentType: string;
    postedAt: Date;
  }>;
  overallEngagement: {
    thisWeek: number;
    lastWeek: number;
    changePercent: number;
  };
}
