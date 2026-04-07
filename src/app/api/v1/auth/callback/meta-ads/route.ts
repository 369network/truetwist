export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { AdAccountManager } from '@/lib/ads/ad-account-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      throw Errors.badRequest(`Meta OAuth error: ${errorParam}`);
    }
    if (!code || !state) {
      throw Errors.badRequest('Missing code or state parameter');
    }

    let stateData: { userId: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      throw Errors.badRequest('Invalid state parameter');
    }

    const credentials = await AdAccountManager.exchangeAndEncrypt('meta', '', code);
    const accountInfo = await AdAccountManager.getAccountInfo({
      platform: 'meta',
      platformAccountId: credentials.platformAccountId,
      accessTokenEncrypted: credentials.accessTokenEncrypted,
      refreshTokenEncrypted: credentials.refreshTokenEncrypted ?? '',
      expiresAt: credentials.expiresAt,
    });

    const account = await prisma.adAccount.upsert({
      where: {
        platform_platformAccountId_userId: {
          platform: 'meta',
          platformAccountId: accountInfo.id,
          userId: stateData.userId,
        },
      },
      update: {
        encryptedAccessToken: credentials.accessTokenEncrypted,
        encryptedRefreshToken: credentials.refreshTokenEncrypted,
        tokenExpiresAt: credentials.expiresAt,
        accountName: accountInfo.name,
        status: 'active',
      },
      create: {
        userId: stateData.userId,
        platform: 'meta',
        platformAccountId: accountInfo.id,
        accountName: accountInfo.name,
        encryptedAccessToken: credentials.accessTokenEncrypted,
        encryptedRefreshToken: credentials.refreshTokenEncrypted,
        tokenExpiresAt: credentials.expiresAt,
        currency: accountInfo.currency ?? 'USD',
        timezone: accountInfo.timezone ?? 'UTC',
      },
    });

    await prisma.adAuditLog.create({
      data: {
        userId: stateData.userId,
        adAccountId: account.id,
        action: 'meta_oauth_connected',
        entityType: 'ad_account',
        entityId: account.id,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    return NextResponse.redirect(`${appUrl}/dashboard/ads?connected=meta`);
  } catch (error) {
    return errorResponse(error);
  }
}
