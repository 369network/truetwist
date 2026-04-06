import type { PlanTier } from '@/types';

export interface PlanConfig {
  name: string;
  monthlyPriceCents: number;
  annualPriceCents: number; // per month, 20% discount
  monthlyCredits: number;
  features: {
    maxSocialAccounts: number;
    maxScheduledPosts: number;
    maxTeamMembers: number;
    aiTextGeneration: boolean;
    aiImageGeneration: boolean;
    aiVideoGeneration: boolean;
    competitorTracking: boolean;
    viralTrends: boolean;
    abTesting: boolean;
    analytics: boolean;
    prioritySupport: boolean;
  };
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  free: {
    name: 'Free',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    monthlyCredits: 0,
    features: {
      maxSocialAccounts: 2,
      maxScheduledPosts: 10,
      maxTeamMembers: 1,
      aiTextGeneration: false,
      aiImageGeneration: false,
      aiVideoGeneration: false,
      competitorTracking: false,
      viralTrends: false,
      abTesting: false,
      analytics: false,
      prioritySupport: false,
    },
  },
  starter: {
    name: 'Starter',
    monthlyPriceCents: 2900,
    annualPriceCents: 2320, // $23.20/mo (20% off)
    monthlyCredits: 100,
    features: {
      maxSocialAccounts: 5,
      maxScheduledPosts: 50,
      maxTeamMembers: 3,
      aiTextGeneration: true,
      aiImageGeneration: true,
      aiVideoGeneration: false,
      competitorTracking: false,
      viralTrends: true,
      abTesting: false,
      analytics: true,
      prioritySupport: false,
    },
  },
  pro: {
    name: 'Pro',
    monthlyPriceCents: 7900,
    annualPriceCents: 6320, // $63.20/mo (20% off)
    monthlyCredits: 500,
    features: {
      maxSocialAccounts: 15,
      maxScheduledPosts: 200,
      maxTeamMembers: 10,
      aiTextGeneration: true,
      aiImageGeneration: true,
      aiVideoGeneration: true,
      competitorTracking: true,
      viralTrends: true,
      abTesting: true,
      analytics: true,
      prioritySupport: false,
    },
  },
  enterprise: {
    name: 'Business',
    monthlyPriceCents: 19900,
    annualPriceCents: 15920, // $159.20/mo (20% off)
    monthlyCredits: 2000,
    features: {
      maxSocialAccounts: -1, // unlimited
      maxScheduledPosts: -1,
      maxTeamMembers: -1,
      aiTextGeneration: true,
      aiImageGeneration: true,
      aiVideoGeneration: true,
      competitorTracking: true,
      viralTrends: true,
      abTesting: true,
      analytics: true,
      prioritySupport: true,
    },
  },
};

// Credit costs per generation type
export const CREDIT_COSTS = {
  text: 1,
  image: 5,
  video: 20,
} as const;

// Credit top-up pricing
export const CREDIT_TOPUP = {
  priceCents: 1000, // $10
  credits: 50,
} as const;

// Dunning retry schedule (days after initial failure)
export const DUNNING_RETRY_DAYS = [1, 3, 5, 7] as const;
export const GRACE_PERIOD_DAYS = 3;

// Trial configuration
export const TRIAL_DAYS = 7;
export const TRIAL_PLAN: PlanTier = 'pro';

// Credit warning threshold (percentage)
export const CREDIT_WARNING_THRESHOLD = 0.8; // 80%

// Stripe price lookup keys (set these in Stripe Dashboard)
export const STRIPE_PRICE_LOOKUP_KEYS = {
  starter_monthly: 'starter_monthly',
  starter_annual: 'starter_annual',
  pro_monthly: 'pro_monthly',
  pro_annual: 'pro_annual',
  enterprise_monthly: 'enterprise_monthly',
  enterprise_annual: 'enterprise_annual',
  credit_topup: 'credit_topup',
} as const;

export type BillingInterval = 'monthly' | 'annual';

export function getPlanFromPriceKey(lookupKey: string): PlanTier | null {
  if (lookupKey.startsWith('starter')) return 'starter';
  if (lookupKey.startsWith('pro')) return 'pro';
  if (lookupKey.startsWith('enterprise')) return 'enterprise';
  return null;
}

export function getIntervalFromPriceKey(lookupKey: string): BillingInterval {
  return lookupKey.endsWith('_annual') ? 'annual' : 'monthly';
}
