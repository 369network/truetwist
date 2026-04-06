import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { createCheckoutSession } from '@/lib/billing';

const checkoutSchema = z.object({
  plan: z.enum(['starter', 'pro', 'enterprise']),
  interval: z.enum(['monthly', 'annual']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      throw Errors.validation(parsed.error.flatten());
    }

    const url = await createCheckoutSession({
      userId: user.sub,
      plan: parsed.data.plan,
      interval: parsed.data.interval,
      successUrl: parsed.data.successUrl,
      cancelUrl: parsed.data.cancelUrl,
    });

    return NextResponse.json({ data: { url } });
  } catch (error) {
    return errorResponse(error);
  }
}
