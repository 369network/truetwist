import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';

// GET /api/v1/social-accounts - List connected social accounts
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);

    const accounts = await prisma.socialAccount.findMany({
      where: { userId: user.sub },
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountHandle: true,
        followerCount: true,
        isActive: true,
        connectedAt: true,
        tokenExpiresAt: true,
      },
      orderBy: { connectedAt: 'desc' },
    });

    // Add token health status
    const accountsWithHealth = accounts.map((account) => ({
      ...account,
      tokenStatus: !account.tokenExpiresAt
        ? 'unknown'
        : account.tokenExpiresAt > new Date()
        ? 'valid'
        : 'expired',
    }));

    return NextResponse.json({ data: accountsWithHealth });
  } catch (error) {
    return errorResponse(error);
  }
}
