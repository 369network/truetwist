import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { createCustomerPortalSession } from '@/lib/billing';

const portalSchema = z.object({
  returnUrl: z.string().url(),
});

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const parsed = portalSchema.safeParse(body);

    if (!parsed.success) {
      throw Errors.validation(parsed.error.flatten());
    }

    const url = await createCustomerPortalSession(user.sub, parsed.data.returnUrl);

    return NextResponse.json({ data: { url } });
  } catch (error) {
    return errorResponse(error);
  }
}
