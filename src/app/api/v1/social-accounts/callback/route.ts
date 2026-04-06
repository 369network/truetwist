export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { errorResponse, Errors } from '@/lib/errors';
import { oauth2Manager } from '@/lib/social/oauth2-manager';
import { getPlatformAdapter } from '@/lib/social/platforms';
import type { Platform } from '@/lib/social/types';

// GET /api/v1/social-accounts/callback?code=...&state=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      const errorDesc = searchParams.get('error_description') || 'Authorization denied';
      return NextResponse.redirect(
        new URL(`/settings/accounts?error=${encodeURIComponent(errorDesc)}`, request.url)
      );
    }

    if (!code || !state) {
      throw Errors.badRequest('Missing code or state parameter');
    }

    // Validate state from Redis
    const stateData = await redis.get(`oauth_state:${state}`);
    if (!stateData) {
      throw Errors.badRequest('Invalid or expired OAuth state');
    }

    const { userId, platform } = JSON.parse(stateData) as {
      userId: string;
      platform: Platform;
    };

    // Get PKCE code verifier if present
    const codeVerifier = await redis.get(`oauth_pkce:${state}`) || undefined;

    // Exchange code for tokens
    const { encrypted } = await oauth2Manager.exchangeCode(platform, code, codeVerifier);

    // Get platform profile info
    const adapter = getPlatformAdapter(platform);
    const decryptedToken = oauth2Manager.decryptAccessToken(encrypted.accessTokenEncrypted);
    const profile = await adapter.getProfile(decryptedToken);

    // Upsert social account
    await prisma.socialAccount.upsert({
      where: {
        userId_platform_platformAccountId: {
          userId,
          platform,
          platformAccountId: profile.id,
        },
      },
      update: {
        accessToken: encrypted.accessTokenEncrypted,
        refreshToken: encrypted.refreshTokenEncrypted,
        tokenExpiresAt: encrypted.expiresAt,
        accountName: profile.name,
        accountHandle: profile.handle,
        followerCount: profile.followerCount ?? 0,
        isActive: true,
      },
      create: {
        userId,
        platform,
        platformAccountId: profile.id,
        accessToken: encrypted.accessTokenEncrypted,
        refreshToken: encrypted.refreshTokenEncrypted,
        tokenExpiresAt: encrypted.expiresAt,
        accountName: profile.name,
        accountHandle: profile.handle,
        followerCount: profile.followerCount ?? 0,
      },
    });

    // Clean up Redis state
    await redis.del(`oauth_state:${state}`);
    await redis.del(`oauth_pkce:${state}`);

    return NextResponse.redirect(
      new URL('/settings/accounts?connected=true', request.url)
    );
  } catch (error) {
    return errorResponse(error);
  }
}
