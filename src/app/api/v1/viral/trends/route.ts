export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/viral/trends?platform=youtube&lifecycle=emerging&limit=20&page=1
export async function GET(request: NextRequest) {
  try {
    getAuthUser(request);

    const { searchParams } = request.nextUrl;
    const platform = searchParams.get('platform');
    const lifecycle = searchParams.get('lifecycle');
    const source = searchParams.get('source');
    const category = searchParams.get('category');
    const minScore = searchParams.get('minScore');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));

    const where: Record<string, unknown> = {};
    if (platform) where.platform = platform;
    if (lifecycle) where.lifecycle = lifecycle;
    if (source) where.source = source;
    if (category) where.category = category;
    if (minScore) where.viralScore = { gte: parseFloat(minScore) };

    const [trends, total] = await Promise.all([
      prisma.viralTrend.findMany({
        where,
        include: {
          hashtags: {
            include: { hashtag: { select: { tag: true, reach: true, trendDirection: true } } },
            take: 10,
          },
          _count: { select: { snapshots: true, alerts: true } },
        },
        orderBy: { viralScore: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.viralTrend.count({ where }),
    ]);

    return NextResponse.json({
      data: trends,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
