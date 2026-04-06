export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiKeyUser, requireScope } from '@/middleware/api-key';
import { errorResponse } from '@/lib/errors';

// GET /api/v1/public/accounts - List connected social accounts
export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'read');

    const accounts = await prisma.socialAccount.findMany({
      where: { userId: apiUser.sub },
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountHandle: true,
        isActive: true,
        followerCount: true,
        connectedAt: true,
      },
      orderBy: { connectedAt: 'desc' },
    });

    return NextResponse.json({ data: accounts });
  } catch (error) {
    return errorResponse(error);
  }
}
