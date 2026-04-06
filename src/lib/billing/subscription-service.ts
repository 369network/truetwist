import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import type { PlanTier } from '@/types';
import {
  PLAN_CONFIGS,
  STRIPE_PRICE_LOOKUP_KEYS,
  TRIAL_DAYS,
  TRIAL_PLAN,
  type BillingInterval,
} from './config';
import { allocateMonthlyCredits } from './credit-service';

function priceLookupKey(plan: PlanTier, interval: BillingInterval): string {
  return `${plan}_${interval}`;
}

export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  });

  if (sub?.stripeCustomerId) return sub.stripeCustomerId;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true },
  });

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId },
  });

  // Upsert subscription record with the customer ID
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: 'free',
      status: 'active',
      stripeCustomerId: customer.id,
    },
    update: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(params: {
  userId: string;
  plan: PlanTier;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  if (params.plan === 'free') {
    throw new Error('Cannot create checkout for free plan');
  }

  const customerId = await getOrCreateStripeCustomer(params.userId);
  const lookupKey = priceLookupKey(params.plan, params.interval);

  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });

  if (!prices.data.length) {
    throw new Error(`No active price found for lookup key: ${lookupKey}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: prices.data[0].id, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { userId: params.userId, plan: params.plan },
    },
    metadata: { userId: params.userId },
  });

  return session.url!;
}

export async function createCustomerPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(userId);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

export async function handleSubscriptionCreated(
  stripeSubscription: {
    id: string;
    customer: string;
    status: string;
    current_period_end: number;
    cancel_at_period_end: boolean;
    trial_end: number | null;
    items: { data: Array<{ price: { lookup_key: string | null } }> };
    metadata: Record<string, string>;
  }
): Promise<void> {
  const userId = stripeSubscription.metadata.userId;
  if (!userId) return;

  const priceKey = stripeSubscription.items.data[0]?.price.lookup_key;
  const plan = priceKey ? planFromLookupKey(priceKey) : (stripeSubscription.metadata.plan as PlanTier);

  if (!plan || plan === 'free') return;

  await prisma.$transaction(async (tx) => {
    await tx.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        status: stripeSubscription.status,
        stripeCustomerId: stripeSubscription.customer as string,
        stripeSubscriptionId: stripeSubscription.id,
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
      update: {
        plan,
        status: stripeSubscription.status,
        stripeSubscriptionId: stripeSubscription.id,
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { plan },
    });
  });

  // Allocate credits for the new billing period
  await allocateMonthlyCredits(userId, plan);
}

export async function handleSubscriptionUpdated(
  stripeSubscription: {
    id: string;
    customer: string;
    status: string;
    current_period_end: number;
    cancel_at_period_end: boolean;
    items: { data: Array<{ price: { lookup_key: string | null } }> };
    metadata: Record<string, string>;
  }
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
    select: { userId: true, plan: true },
  });

  if (!sub) return;

  const priceKey = stripeSubscription.items.data[0]?.price.lookup_key;
  const newPlan = priceKey ? planFromLookupKey(priceKey) : sub.plan;

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { stripeSubscriptionId: stripeSubscription.id },
      data: {
        plan: newPlan ?? sub.plan,
        status: stripeSubscription.status,
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });

    if (newPlan && newPlan !== sub.plan) {
      await tx.user.update({
        where: { id: sub.userId },
        data: { plan: newPlan },
      });
    }
  });

  // If plan changed, reallocate credits
  if (newPlan && newPlan !== sub.plan) {
    await allocateMonthlyCredits(sub.userId, newPlan as PlanTier);
  }
}

export async function handleSubscriptionDeleted(
  stripeSubscription: { id: string }
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
    select: { userId: true },
  });

  if (!sub) return;

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { stripeSubscriptionId: stripeSubscription.id },
      data: { status: 'canceled', cancelAtPeriodEnd: false },
    });

    await tx.user.update({
      where: { id: sub.userId },
      data: { plan: 'free' },
    });
  });
}

export async function cancelSubscription(userId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeSubscriptionId: true },
  });

  if (!sub?.stripeSubscriptionId) {
    throw new Error('No active subscription found');
  }

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function resumeSubscription(userId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeSubscriptionId: true, cancelAtPeriodEnd: true },
  });

  if (!sub?.stripeSubscriptionId || !sub.cancelAtPeriodEnd) {
    throw new Error('No canceling subscription to resume');
  }

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

export async function getSubscriptionDetails(userId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!sub) {
    return {
      plan: 'free' as PlanTier,
      status: 'active',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      config: PLAN_CONFIGS.free,
    };
  }

  const plan = sub.plan as PlanTier;
  return {
    plan,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    config: PLAN_CONFIGS[plan] ?? PLAN_CONFIGS.free,
  };
}

function planFromLookupKey(lookupKey: string): PlanTier | null {
  if (lookupKey.startsWith('starter')) return 'starter';
  if (lookupKey.startsWith('pro')) return 'pro';
  if (lookupKey.startsWith('enterprise')) return 'enterprise';
  return null;
}
