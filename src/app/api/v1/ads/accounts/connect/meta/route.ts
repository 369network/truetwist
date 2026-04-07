export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { AdAccountManager } from '@/lib/ads/ad-account-manager';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const state = Buffer.from(
      JSON.stringify({ userId: user.sub, nonce: crypto.randomUUID() })
    ).toString('base64url');

    const authUrl = AdAccountManager.getAuthorizationUrl('meta', '', state);
    return NextResponse.json({ data: { authorizationUrl: authUrl, state } });
  } catch (error) {
    return errorResponse(error);
  }
}
