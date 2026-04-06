/**
 * Tests for /api/v1/billing/* — subscription, checkout, credits, usage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  TEST_USER,
  buildAuthRequest,
  parseResponse,
} from './helpers';
import { generateAccessToken } from '@/lib/auth';
import type { PlanTier } from '@/types';

// Mock billing service functions
const mockGetSubscriptionDetails = vi.fn();
const mockCancelSubscription = vi.fn();
const mockResumeSubscription = vi.fn();
const mockCreateCheckoutSession = vi.fn();
const mockGetCreditBalance = vi.fn();
const mockGetCreditTransactions = vi.fn();
const mockCreateCreditTopupCheckout = vi.fn();
const mockGetUsageSummary = vi.fn();

vi.mock('@/lib/billing', () => ({
  getSubscriptionDetails: (...args: unknown[]) => mockGetSubscriptionDetails(...args),
  cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
  resumeSubscription: (...args: unknown[]) => mockResumeSubscription(...args),
  createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
  getCreditBalance: (...args: unknown[]) => mockGetCreditBalance(...args),
  getCreditTransactions: (...args: unknown[]) => mockGetCreditTransactions(...args),
  createCreditTopupCheckout: (...args: unknown[]) => mockCreateCreditTopupCheckout(...args),
  getUsageSummary: (...args: unknown[]) => mockGetUsageSummary(...args),
  CREDIT_TOPUP: { priceCents: 999, credits: 100 },
}));
vi.mock('@/lib/audit', () => ({
  auditFromRequest: vi.fn(),
  auditLog: vi.fn(),
  AuditActions: {},
}));

// Import all route handlers at top level
const subscriptionRoute = await import('@/app/api/v1/billing/subscription/route');
const checkoutRoute = await import('@/app/api/v1/billing/checkout/route');
const creditsRoute = await import('@/app/api/v1/billing/credits/route');
const usageRoute = await import('@/app/api/v1/billing/usage/route');

const token = generateAccessToken(TEST_USER.id, TEST_USER.email, TEST_USER.plan as PlanTier);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Subscription routes ──

describe('GET /api/v1/billing/subscription', () => {
  it('should return 401 without auth', async () => {
    const req = new NextRequest(
      new URL('http://localhost:3000/api/v1/billing/subscription'),
      { method: 'GET' }
    );
    const res = await subscriptionRoute.GET(req);
    expect(res.status).toBe(401);
  });

  it('should return subscription details', async () => {
    const details = {
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-05-01T00:00:00Z',
      cancelAtPeriodEnd: false,
    };
    mockGetSubscriptionDetails.mockResolvedValue(details);

    const req = buildAuthRequest('GET', '/api/v1/billing/subscription', token);
    const res = await subscriptionRoute.GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.plan).toBe('pro');
    expect(body.data.status).toBe('active');
  });
});

describe('POST /api/v1/billing/subscription', () => {
  it('should cancel subscription', async () => {
    mockCancelSubscription.mockResolvedValue(undefined);
    mockGetSubscriptionDetails.mockResolvedValue({ plan: 'pro', status: 'canceling' });

    const req = buildAuthRequest('POST', '/api/v1/billing/subscription', token, {
      body: { action: 'cancel' },
    });
    const res = await subscriptionRoute.POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(mockCancelSubscription).toHaveBeenCalledWith(TEST_USER.id);
    expect(body.data.status).toBe('canceling');
  });

  it('should resume subscription', async () => {
    mockResumeSubscription.mockResolvedValue(undefined);
    mockGetSubscriptionDetails.mockResolvedValue({ plan: 'pro', status: 'active' });

    const req = buildAuthRequest('POST', '/api/v1/billing/subscription', token, {
      body: { action: 'resume' },
    });
    const res = await subscriptionRoute.POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(mockResumeSubscription).toHaveBeenCalledWith(TEST_USER.id);
  });

  it('should reject invalid action', async () => {
    const req = buildAuthRequest('POST', '/api/v1/billing/subscription', token, {
      body: { action: 'invalid' },
    });
    const res = await subscriptionRoute.POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(422);
  });
});

// ── Checkout route ──

describe('POST /api/v1/billing/checkout', () => {
  it('should return 401 without auth', async () => {
    const req = new NextRequest(
      new URL('http://localhost:3000/api/v1/billing/checkout'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    const res = await checkoutRoute.POST(req);
    expect(res.status).toBe(401);
  });

  it('should create checkout session', async () => {
    mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/session_123');

    const req = buildAuthRequest('POST', '/api/v1/billing/checkout', token, {
      body: {
        plan: 'pro',
        interval: 'monthly',
        successUrl: 'https://app.truetwist.com/billing/success',
        cancelUrl: 'https://app.truetwist.com/billing/cancel',
      },
    });
    const res = await checkoutRoute.POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.url).toContain('stripe.com');
  });

  it('should reject invalid plan', async () => {
    const req = buildAuthRequest('POST', '/api/v1/billing/checkout', token, {
      body: {
        plan: 'mega',
        interval: 'monthly',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      },
    });
    const res = await checkoutRoute.POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(422);
  });
});

// ── Credits route ──

describe('GET /api/v1/billing/credits', () => {
  it('should return credit balance', async () => {
    mockGetCreditBalance.mockResolvedValue(500);

    const req = buildAuthRequest('GET', '/api/v1/billing/credits', token);
    const res = await creditsRoute.GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.balance).toBe(500);
    expect(body.data.pricing.topUpPriceCents).toBe(999);
  });

  it('should include transactions when requested', async () => {
    mockGetCreditBalance.mockResolvedValue(500);
    mockGetCreditTransactions.mockResolvedValue({
      transactions: [{ id: 'tx-1', amount: -10, type: 'usage' }],
      total: 1,
    });

    const req = buildAuthRequest('GET', '/api/v1/billing/credits?transactions=true', token);
    const res = await creditsRoute.GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.transactions).toHaveLength(1);
    expect(body.data.totalTransactions).toBe(1);
  });
});

describe('POST /api/v1/billing/credits', () => {
  it('should create credit topup checkout', async () => {
    mockCreateCreditTopupCheckout.mockResolvedValue('https://checkout.stripe.com/topup_123');

    const req = buildAuthRequest('POST', '/api/v1/billing/credits', token, {
      body: {
        quantity: 3,
        successUrl: 'https://app.truetwist.com/credits/success',
        cancelUrl: 'https://app.truetwist.com/credits/cancel',
      },
    });
    const res = await creditsRoute.POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.url).toContain('stripe.com');
  });

  it('should reject invalid quantity', async () => {
    const req = buildAuthRequest('POST', '/api/v1/billing/credits', token, {
      body: {
        quantity: 50,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      },
    });
    const res = await creditsRoute.POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(422);
  });
});

// ── Usage route ──

describe('GET /api/v1/billing/usage', () => {
  it('should return usage summary', async () => {
    const summary = {
      postsUsed: 25,
      postsLimit: 100,
      aiCreditsUsed: 50,
      storageUsedMb: 150,
    };
    mockGetUsageSummary.mockResolvedValue(summary);

    const req = buildAuthRequest('GET', '/api/v1/billing/usage', token);
    const res = await usageRoute.GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.postsUsed).toBe(25);
    expect(body.data.postsLimit).toBe(100);
  });

  it('should return 401 without auth', async () => {
    const req = new NextRequest(
      new URL('http://localhost:3000/api/v1/billing/usage'),
      { method: 'GET' }
    );
    const res = await usageRoute.GET(req);
    expect(res.status).toBe(401);
  });
});
