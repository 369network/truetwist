export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { AdAccountManager } from '@/lib/ads/ad-account-manager';
import { signOAuthState } from '@/lib/ads/oauth-state';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const state = signOAuthState({ userId: user.sub });

    const authUrl = AdAccountManager.getAuthorizationUrl('meta', '', state);
    return NextResponse.json({ data: { authorizationUrl: authUrl, state } });
  } catch (error) {
    return errorResponse(error);
  }
}
