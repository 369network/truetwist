import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import {
  getSubscriptionDetails,
  cancelSubscription,
  resumeSubscription,
} from '@/lib/billing';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const details = await getSubscriptionDetails(user.sub);
    return NextResponse.json({ data: details });
  } catch (error) {
    return errorResponse(error);
  }
}

const actionSchema = z.object({
  action: z.enum(['cancel', 'resume']),
});

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { error: 'Invalid action', code: 'VALIDATION_ERROR' } },
        { status: 422 }
      );
    }

    if (parsed.data.action === 'cancel') {
      await cancelSubscription(user.sub);
    } else {
      await resumeSubscription(user.sub);
    }

    const details = await getSubscriptionDetails(user.sub);
    return NextResponse.json({ data: details });
  } catch (error) {
    return errorResponse(error);
  }
}
