import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { redis } from '@/lib/redis';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { oauth2Manager } from '@/lib/social/oauth2-manager';
import { PlatformSchema } from '@/lib/social/types';
import { z } from 'zod';

const connectSchema = z.object({
  platform: PlatformSchema,
});

// POST /api/v1/social-accounts/connect - Initiate OAuth flow for a platform
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = connectSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { platform } = result.data;

    // Generate state parameter to prevent CSRF
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in Redis with user context (10 min expiry)
    await redis.setex(
      `oauth_state:${state}`,
      600,
      JSON.stringify({ userId: user.sub, platform })
    );

    const { url, codeVerifier } = oauth2Manager.getAuthorizationUrl(platform, state);

    // Store PKCE code verifier if present
    if (codeVerifier) {
      await redis.setex(`oauth_pkce:${state}`, 600, codeVerifier);
    }

    return NextResponse.json({
      data: { authorizationUrl: url, state },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
