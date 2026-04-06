export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import {
  getCreditBalance,
  getCreditTransactions,
  createCreditTopupCheckout,
  CREDIT_TOPUP,
} from '@/lib/billing';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const includeTransactions = searchParams.get('transactions') === 'true';
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100);
    const offset = Number(searchParams.get('offset')) || 0;

    const balance = await getCreditBalance(user.sub);

    let transactions;
    if (includeTransactions) {
      transactions = await getCreditTransactions(user.sub, { limit, offset });
    }

    return NextResponse.json({
      data: {
        balance,
        ...(transactions ? { transactions: transactions.transactions, totalTransactions: transactions.total } : {}),
        pricing: {
          topUpPriceCents: CREDIT_TOPUP.priceCents,
          topUpCredits: CREDIT_TOPUP.credits,
        },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

const topupSchema = z.object({
  quantity: z.number().int().min(1).max(20),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const parsed = topupSchema.safeParse(body);

    if (!parsed.success) {
      throw Errors.validation(parsed.error.flatten());
    }

    const url = await createCreditTopupCheckout({
      userId: user.sub,
      quantity: parsed.data.quantity,
      successUrl: parsed.data.successUrl,
      cancelUrl: parsed.data.cancelUrl,
    });

    return NextResponse.json({ data: { url } });
  } catch (error) {
    return errorResponse(error);
  }
}
