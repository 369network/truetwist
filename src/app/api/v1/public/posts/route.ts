import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiKeyUser, requireScope } from '@/middleware/api-key';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/public/posts - List posts
export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'read');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20', 10), 100);
    const status = searchParams.get('status');
    const businessId = searchParams.get('businessId');

    const where: Record<string, unknown> = { userId: apiUser.sub };
    if (status) where.status = status;
    if (businessId) where.businessId = businessId;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          businessId: true,
          contentText: true,
          contentType: true,
          status: true,
          aiGenerated: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where }),
    ]);

    return NextResponse.json({
      data: posts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/public/posts - Create a post
export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'write');

    const body = await request.json();
    const { businessId, contentText, contentType = 'text' } = body;

    if (!businessId) throw Errors.validation({ businessId: 'businessId is required' });
    if (!contentText) throw Errors.validation({ contentText: 'contentText is required' });

    // Verify business belongs to user
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: apiUser.sub },
    });

    if (!business) throw Errors.notFound('Business');

    const post = await prisma.post.create({
      data: {
        userId: apiUser.sub,
        businessId,
        contentText,
        contentType,
        status: 'draft',
      },
      select: {
        id: true,
        businessId: true,
        contentText: true,
        contentType: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
