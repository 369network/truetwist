export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid';
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';
export type SocialPlatform = 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube' | 'pinterest' | 'threads';
export type PostStatus = 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed';
export type ContentType = 'text' | 'image' | 'video' | 'carousel';
export type PostScheduleStatus = 'pending' | 'posting' | 'posted' | 'failed' | 'retry';

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  plan: PlanTier;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}
