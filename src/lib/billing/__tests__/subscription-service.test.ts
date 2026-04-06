import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn({
      subscription: {
        upsert: vi.fn(),
        update: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
    })),
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { create: vi.fn() },
    prices: { list: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { update: vi.fn() },
  },
}));

vi.mock('../credit-service', () => ({
  allocateMonthlyCredits: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  getOrCreateStripeCustomer,
  createCheckoutSession,
  createCustomerPortalSession,
  getSubscriptionDetails,
  cancelSubscription,
  resumeSubscription,
  handleSubscriptionDeleted,
} from '../subscription-service';

describe('SubscriptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateStripeCustomer', () => {
    it('should return existing customer ID', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        stripeCustomerId: 'cus_existing',
      } as any);

      const result = await getOrCreateStripeCustomer('user-1');
      expect(result).toBe('cus_existing');
      expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it('should create new Stripe customer when none exists', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
        email: 'test@example.com',
        name: 'Test User',
      } as any);
      vi.mocked(stripe.customers.create).mockResolvedValue({
        id: 'cus_new',
      } as any);
      vi.mocked(prisma.subscription.upsert).mockResolvedValue({} as any);

      const result = await getOrCreateStripeCustomer('user-1');

      expect(result).toBe('cus_new');
      expect(stripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-1' },
      });
    });
  });

  describe('createCheckoutSession', () => {
    it('should throw for free plan', async () => {
      await expect(
        createCheckoutSession({
          userId: 'user-1',
          plan: 'free' as any,
          interval: 'monthly',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow('Cannot create checkout for free plan');
    });

    it('should create checkout session with correct price lookup', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        stripeCustomerId: 'cus_test',
      } as any);
      vi.mocked(stripe.prices.list).mockResolvedValue({
        data: [{ id: 'price_pro_monthly' }],
      } as any);
      vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
        url: 'https://checkout.stripe.com/session123',
      } as any);

      const url = await createCheckoutSession({
        userId: 'user-1',
        plan: 'pro',
        interval: 'monthly',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(url).toBe('https://checkout.stripe.com/session123');
      expect(stripe.prices.list).toHaveBeenCalledWith({
        lookup_keys: ['pro_monthly'],
        active: true,
        limit: 1,
      });
    });
  });

  describe('createCustomerPortalSession', () => {
    it('should create portal session', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        stripeCustomerId: 'cus_test',
      } as any);
      vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
        url: 'https://billing.stripe.com/portal123',
      } as any);

      const url = await createCustomerPortalSession('user-1', 'https://example.com');

      expect(url).toBe('https://billing.stripe.com/portal123');
    });
  });

  describe('getSubscriptionDetails', () => {
    it('should return free plan details when no subscription', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      const details = await getSubscriptionDetails('user-1');

      expect(details.plan).toBe('free');
      expect(details.status).toBe('active');
      expect(details.config.name).toBe('Free');
    });

    it('should return subscription details for paid plan', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        plan: 'pro',
        status: 'active',
        currentPeriodEnd: new Date('2026-05-01'),
        cancelAtPeriodEnd: false,
      } as any);

      const details = await getSubscriptionDetails('user-1');

      expect(details.plan).toBe('pro');
      expect(details.status).toBe('active');
      expect(details.config.monthlyPriceCents).toBe(7900);
      expect(details.config.monthlyCredits).toBe(500);
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel at period end', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        stripeSubscriptionId: 'sub_test',
      } as any);

      await cancelSubscription('user-1');

      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_test', {
        cancel_at_period_end: true,
      });
    });

    it('should throw when no subscription exists', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      await expect(cancelSubscription('user-1')).rejects.toThrow('No active subscription found');
    });
  });

  describe('resumeSubscription', () => {
    it('should resume a canceling subscription', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        stripeSubscriptionId: 'sub_test',
        cancelAtPeriodEnd: true,
      } as any);

      await resumeSubscription('user-1');

      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_test', {
        cancel_at_period_end: false,
      });
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('should downgrade user to free plan', async () => {
      const mockTx = {
        subscription: { update: vi.fn() },
        user: { update: vi.fn() },
      };
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        userId: 'user-1',
      } as any);
      vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx));

      await handleSubscriptionDeleted({ id: 'sub_test' });

      expect(mockTx.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'canceled' }),
        })
      );
      expect(mockTx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { plan: 'free' },
        })
      );
    });
  });
});
