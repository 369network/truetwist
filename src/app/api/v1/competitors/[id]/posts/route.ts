import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/competitors/:id/posts?platform=xxx&viral=true&limit=20&offset=0
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = getAuthUser(request);
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform');
    const viralOnly = searchParams.get('viral') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const competitor = await prisma.competitor.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });
    if (!competitor || competitor.business.userId !== auth.sub) {
      throw Errors.notFound('Competitor');
    }

    // Get competitor's account IDs, optionally filtered by platform
    const accountWhere: Record<string, unknown> = { competitorId: id };
    if (platform) accountWhere.platform = platform;

    const accounts = await prisma.competitorAccount.findMany({
      where: accountWhere,
      select: { id: true },
    });
    const accountIds = accounts.map(a => a.id);

    if (accountIds.length === 0) {
      return NextResponse.json({ data: [], total: 0, limit, offset });
    }

    const postWhere: Record<string, unknown> = {
      competitorAccountId: { in: accountIds },
    };
    if (viralOnly) postWhere.isViral = true;

    const [posts, total] = await Promise.all([
      prisma.competitorPost.findMany({
        where: postWhere,
        orderBy: { postedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          competitorAccount: {
            select: { platform: true, handle: true },
          },
        },
      }),
      prisma.competitorPost.count({ where: postWhere }),
    ]);

    return NextResponse.json({ data: posts, total, limit, offset });
  } catch (error) {
    return errorResponse(error);
  }
}
