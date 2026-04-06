import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import type { PlanTier } from '@/types';
import {
  PLAN_CONFIGS,
  CREDIT_COSTS,
  CREDIT_TOPUP,
  CREDIT_WARNING_THRESHOLD,
} from './config';
import { getOrCreateStripeCustomer } from './subscription-service';

export interface CreditBalance {
  balance: number;
  monthlyAllocation: number;
  used: number;
  topUpCredits: number;
  warningThreshold: boolean; // true when >= 80% used
  periodStart: Date;
  periodEnd: Date;
}

export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const balance = await prisma.creditBalance.findUnique({
    where: { userId },
  });

  if (!balance) {
    return {
      balance: 0,
      monthlyAllocation: 0,
      used: 0,
      topUpCredits: 0,
      warningThreshold: false,
      periodStart: new Date(),
      periodEnd: new Date(),
    };
  }

  const used = balance.monthlyAllocation + balance.topUpCredits - balance.balance;
  const totalCredits = balance.monthlyAllocation + balance.topUpCredits;
  const usedPercent = totalCredits > 0 ? used / totalCredits : 0;

  return {
    balance: balance.balance,
    monthlyAllocation: balance.monthlyAllocation,
    used: Math.max(0, used),
    topUpCredits: balance.topUpCredits,
    warningThreshold: usedPercent >= CREDIT_WARNING_THRESHOLD,
    periodStart: balance.periodStart,
    periodEnd: balance.periodEnd,
  };
}

export async function consumeCredits(
  userId: string,
  type: keyof typeof CREDIT_COSTS,
  description: string
): Promise<{ allowed: boolean; remaining: number; cost: number }> {
  const cost = CREDIT_COSTS[type];

  const result = await prisma.$transaction(async (tx) => {
    const balance = await tx.creditBalance.findUnique({
      where: { userId },
    });

    if (!balance || balance.balance < cost) {
      return { allowed: false, remaining: balance?.balance ?? 0, cost };
    }

    const updated = await tx.creditBalance.update({
      where: { userId },
      data: { balance: { decrement: cost } },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: -cost,
        type: 'consumption',
        description,
        balanceAfter: updated.balance,
      },
    });

    return { allowed: true, remaining: updated.balance, cost };
  });

  return result;
}

export async function allocateMonthlyCredits(
  userId: string,
  plan: PlanTier
): Promise<void> {
  const config = PLAN_CONFIGS[plan];
  if (!config || config.monthlyCredits === 0) return;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.creditBalance.findUnique({
      where: { userId },
    });

    if (existing && existing.periodStart >= periodStart) {
      // Already allocated for this period — update allocation if plan changed
      if (existing.monthlyAllocation !== config.monthlyCredits) {
        const diff = config.monthlyCredits - existing.monthlyAllocation;
        await tx.creditBalance.update({
          where: { userId },
          data: {
            monthlyAllocation: config.monthlyCredits,
            balance: { increment: Math.max(0, diff) },
          },
        });
      }
      return;
    }

    // New period or first allocation: reset to fresh monthly credits + carry over top-ups
    const topUpCredits = existing?.topUpCredits ?? 0;

    await tx.creditBalance.upsert({
      where: { userId },
      create: {
        userId,
        balance: config.monthlyCredits,
        monthlyAllocation: config.monthlyCredits,
        topUpCredits: 0,
        periodStart,
        periodEnd,
      },
      update: {
        balance: config.monthlyCredits + topUpCredits,
        monthlyAllocation: config.monthlyCredits,
        topUpCredits, // carry over unused top-ups
        periodStart,
        periodEnd,
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: config.monthlyCredits,
        type: 'monthly_allocation',
        description: `Monthly credit allocation for ${config.name} plan`,
        balanceAfter: config.monthlyCredits + topUpCredits,
      },
    });
  });
}

export async function createCreditTopupCheckout(params: {
  userId: string;
  quantity: number; // number of top-up packs
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(params.userId);

  const prices = await stripe.prices.list({
    lookup_keys: ['credit_topup'],
    active: true,
    limit: 1,
  });

  if (!prices.data.length) {
    throw new Error('Credit top-up price not configured in Stripe');
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [{
      price: prices.data[0].id,
      quantity: params.quantity,
    }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
      type: 'credit_topup',
      packs: String(params.quantity),
    },
  });

  return session.url!;
}

export async function addTopUpCredits(
  userId: string,
  packs: number
): Promise<void> {
  const credits = packs * CREDIT_TOPUP.credits;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.creditBalance.update({
      where: { userId },
      data: {
        balance: { increment: credits },
        topUpCredits: { increment: credits },
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: credits,
        type: 'topup',
        description: `Purchased ${packs} credit pack(s) (${credits} credits)`,
        balanceAfter: updated.balance,
      },
    });
  });
}

export async function getCreditTransactions(
  userId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 20, offset = 0 } = options;

  const [transactions, total] = await Promise.all([
    prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.creditTransaction.count({ where: { userId } }),
  ]);

  return { transactions, total };
}
