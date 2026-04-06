const API_BASE = '/api/v1';

class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'UNKNOWN', message: res.statusText } }));
    throw new ApiClientError(
      res.status,
      body.error?.code || 'UNKNOWN',
      body.error?.message || body.error?.error || res.statusText,
      body.error?.details
    );
  }

  return res.json();
}

// AI Generation
export const aiApi = {
  generateText: (data: {
    prompt: string;
    platforms: string[];
    variations?: number;
    businessId?: string;
  }) =>
    request<{
      data: {
        type: 'text';
        variations: Array<{
          id: string;
          text: string;
          platforms: Array<{
            platform: string;
            charCount: number;
            maxChars: number;
            withinLimit: boolean;
          }>;
        }>;
        suggestedHashtags: string[];
      };
    }>('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'text', ...data }),
    }),

  generateImages: (data: {
    prompt: string;
    style?: string;
    count?: number;
    businessId?: string;
  }) =>
    request<{
      data: {
        type: 'image';
        images: Array<{
          id: string;
          url: string;
          thumbnailUrl: string;
          width: number;
          height: number;
          style: string;
        }>;
      };
    }>('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'image', ...data }),
    }),
};

// Posts
export const postsApi = {
  list: (params?: { businessId?: string; status?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.businessId) qs.set('businessId', params.businessId);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    return request<{ data: Post[]; total: number; page: number; pageSize: number; totalPages: number }>(
      `/posts?${qs.toString()}`
    );
  },

  get: (id: string) => request<{ data: Post }>(`/posts/${id}`),

  create: (data: { businessId: string; contentText?: string; contentType?: string }) =>
    request<{ data: Post }>('/posts', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: { contentText?: string; contentType?: string; status?: string }) =>
    request<{ data: Post }>(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => request<{ data: { message: string } }>(`/posts/${id}`, { method: 'DELETE' }),

  schedule: (id: string, data: { socialAccountId: string; platform: string; scheduledAt: string }) =>
    request<{ data: PostSchedule }>(`/posts/${id}/schedule`, { method: 'POST', body: JSON.stringify(data) }),

  reschedule: (postId: string, scheduleId: string, scheduledAt: string) =>
    request<{ data: PostSchedule }>(`/posts/${postId}/schedule`, {
      method: 'PATCH',
      body: JSON.stringify({ scheduleId, scheduledAt }),
    }),

  getSchedules: (id: string) => request<{ data: PostSchedule[] }>(`/posts/${id}/schedules`),
};

// Calendar
export const calendarApi = {
  getEvents: (start: string, end: string) =>
    request<{ data: CalendarResponse }>(`/calendar?start=${start}&end=${end}`),
};

// Analytics
export const analyticsApi = {
  getSummary: (range: string, businessId?: string) => {
    const qs = new URLSearchParams({ range });
    if (businessId) qs.set('businessId', businessId);
    return request<{ data: AnalyticsSummary }>(`/analytics?${qs.toString()}`);
  },
};

// Social Accounts
export const socialAccountsApi = {
  list: () => request<{ data: SocialAccount[] }>('/social-accounts'),

  connect: (platform: string) =>
    request<{ data: { authorizationUrl: string; state: string } }>('/social-accounts/connect', {
      method: 'POST',
      body: JSON.stringify({ platform }),
    }),

  disconnect: (id: string) =>
    request<{ data: { message: string } }>(`/social-accounts/${id}`, { method: 'DELETE' }),
};

// Types
export interface Post {
  id: string;
  userId: string;
  businessId: string;
  contentText: string | null;
  contentType: string;
  status: string;
  aiGenerated: boolean;
  viralScore: number | null;
  createdAt: string;
  updatedAt: string;
  business?: { id: string; name: string };
  media?: PostMedia[];
  schedules?: PostSchedule[];
}

export interface PostMedia {
  id: string;
  mediaType: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export interface PostSchedule {
  id: string;
  postId: string;
  socialAccountId: string;
  platform: string;
  scheduledAt: string;
  postedAt: string | null;
  status: string;
  socialAccount?: {
    id: string;
    platform: string;
    accountName: string | null;
    accountHandle: string | null;
  };
}

export interface CalendarEvent {
  id: string;
  postId: string;
  title: string;
  contentType: string;
  platform: string;
  accountName: string | null;
  accountHandle: string | null;
  scheduledAt: string;
  postedAt: string | null;
  status: string;
  crossPostGroup: string | null;
  businessName: string | null;
  thumbnailUrl: string | null;
}

export interface CalendarDay {
  date: string;
  totalPosts: number;
  platforms: string[];
  schedules: CalendarEvent[];
}

export interface CalendarResponse {
  view: string;
  from: string;
  to: string;
  totalSchedules: number;
  days: CalendarDay[];
}

export interface SocialAccount {
  id: string;
  platform: string;
  accountName: string | null;
  accountHandle: string | null;
  followerCount: number;
  isActive: boolean;
  connectedAt: string;
  tokenExpiresAt: string | null;
  tokenStatus: 'valid' | 'expired' | 'unknown';
}

export interface AnalyticsSummary {
  summary: {
    totalImpressions: number;
    totalEngagements: number;
    totalFollowers: number;
    totalClicks: number;
    engagementRate: string;
  };
  platformMetrics: Record<string, {
    impressions: number;
    engagements: number;
    followers: number;
    posts: number;
  }>;
  topPosts: Array<{
    title: string;
    platform: string;
    impressions: number;
    engagementRate: number;
    likes: number;
    comments: number;
    shares: number;
  }>;
  growthData: Array<{
    period: string;
    impressions: number;
    engagements: number;
    avgEngagementRate: string;
  }>;
  dateRange: { start: string; end: string; days: number };
}

// Viral Trends
export const trendsApi = {
  list: (params?: { platform?: string; niche?: string }) => {
    const qs = new URLSearchParams();
    if (params?.platform) qs.set('platform', params.platform);
    if (params?.niche) qs.set('niche', params.niche);
    return request<{ data: TrendItem[] }>(`/trends?${qs.toString()}`);
  },

  get: (id: string) => request<{ data: TrendDetail }>(`/trends/${id}`),

  getAlerts: () => request<{ data: TrendAlert[] }>('/trends/alerts'),
};

// A/B Testing
export const abTestApi = {
  list: (params?: { status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    return request<{ data: AbTest[] }>(`/ab-tests?${qs.toString()}`);
  },

  get: (id: string) => request<{ data: AbTest }>(`/ab-tests/${id}`),

  create: (data: {
    name: string;
    variants: Array<{ postId: string; label: string }>;
    platforms: string[];
    duration: number;
  }) =>
    request<{ data: AbTest }>('/ab-tests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  stop: (id: string) =>
    request<{ data: AbTest }>(`/ab-tests/${id}/stop`, { method: 'POST' }),
};

// AI Suggestions for Calendar
export const aiSuggestionsApi = {
  getOptimalSlots: (params: { start: string; end: string }) =>
    request<{ data: AiSuggestionSlot[] }>(`/ai/optimal-slots?start=${params.start}&end=${params.end}`),

  generateWeek: (params: { start: string; businessId: string }) =>
    request<{ data: { posts: Post[] } }>('/ai/generate-week', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

export interface TrendItem {
  id: string;
  topic: string;
  viralScore: number;
  velocity: number;
  platforms: string[];
  hashtags: string[];
  category: string;
  updatedAt: string;
}

export interface TrendDetail extends TrendItem {
  velocityData: Array<{ period: string; score: number }>;
  relatedHashtags: string[];
  examplePosts: Array<{
    id: string;
    text: string;
    platform: string;
    engagement: number;
    author: string;
  }>;
}

export interface TrendAlert {
  id: string;
  trendId: string;
  topic: string;
  viralScore: number;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface AbTest {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'completed' | 'stopped';
  variants: Array<{
    id: string;
    label: string;
    postId: string;
    impressions: number;
    engagements: number;
    clicks: number;
    engagementRate: number;
    isWinner: boolean;
  }>;
  platforms: string[];
  duration: number;
  confidence: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AiSuggestionSlot {
  date: string;
  time: string;
  score: number;
  reason: string;
  suggestedPlatforms: string[];
}

// Video A/B Testing
export const videoAbTestApi = {
  list: (params?: { status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    return request<{ data: VideoAbTest[] }>(`/ai/video/ab-test?${qs.toString()}`);
  },

  get: (id: string) => request<{ data: VideoAbTest & { significance: SignificanceResult | null } }>(`/ai/video/ab-test/${id}`),

  create: (data: {
    businessId: string;
    name: string;
    description?: string;
    targetMetric?: string;
    baseConfig: {
      prompt: string;
      platform: string;
      template?: string;
      aspectRatio?: string;
      durationSeconds?: number;
    };
    variationParams: Array<{ field: string; values: string[] }>;
    autoGenerate?: boolean;
  }) =>
    request<{ data: VideoAbTest }>('/ai/video/ab-test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  action: (id: string, action: 'generate' | 'complete' | 'cancel', winnerId?: string) =>
    request<{ data: VideoAbTest }>(`/ai/video/ab-test/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, winnerId }),
    }),

  updateMetrics: (testId: string, variantId: string, metrics: {
    impressions?: number;
    clicks?: number;
    watchTimeSeconds?: number;
    completionRate?: number;
    conversions?: number;
    engagements?: number;
  }) =>
    request<{ data: VideoAbTestVariant }>(`/ai/video/ab-test/${testId}/variants/${variantId}/metrics`, {
      method: 'PATCH',
      body: JSON.stringify(metrics),
    }),

  selectWinner: (testId: string, winnerId?: string) =>
    request<{ data: VideoAbTest }>(`/ai/video/ab-test/${testId}/winner`, {
      method: 'POST',
      body: JSON.stringify({ winnerId }),
    }),
};

export interface VideoAbTest {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'generating' | 'running' | 'completed' | 'cancelled';
  targetMetric: string;
  baseConfig: {
    prompt: string;
    platform: string;
    template?: string;
    aspectRatio?: string;
    durationSeconds?: number;
  };
  variationParams: Array<{ field: string; values: string[] }>;
  variants: VideoAbTestVariant[];
  winnerId: string | null;
  winnerReason: string | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
}

export interface VideoAbTestVariant {
  id: string;
  label: string;
  config: Record<string, unknown>;
  videoJobId: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  status: string;
  impressions: number;
  clicks: number;
  watchTimeSeconds: number;
  completionRate: number;
  conversions: number;
  engagements: number;
  engagementRate: number;
  isWinner: boolean;
}

export interface SignificanceResult {
  significant: boolean;
  confidence: number;
  winnerId: string | null;
  winnerLabel: string | null;
  reason: string;
}

export { ApiClientError };
