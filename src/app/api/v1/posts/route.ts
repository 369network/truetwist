export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { z } from 'zod';

const createPostSchema = z.object({
  businessId: z.string().uuid(),
  contentText: z.string().max(10000).optional(),
  contentType: z.enum(['text', 'image', 'video', 'carousel']).default('text'),
});

// GET /api/v1/posts - List user's posts
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);

    const businessId = searchParams.get('businessId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20', 10), 100);

    const where: Record<string, unknown> = { userId: user.sub };
    if (businessId) {
      // Verify user owns this business before filtering
      const business = await prisma.business.findFirst({
        where: { id: businessId, userId: user.sub },
        select: { id: true },
      });
      if (!business) {
        throw Errors.notFound('Business');
      }
      where.businessId = businessId;
    }
    if (status) where.status = status;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          business: { select: { id: true, name: true } },
          media: true,
          schedules: {
            select: { id: true, platform: true, scheduledAt: true, status: true },
          },
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

// POST /api/v1/posts - Create a new post
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = createPostSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { businessId, contentText, contentType } = result.data;

    // Verify ownership of business
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: user.sub },
    });

    if (!business) {
      throw Errors.notFound('Business');
    }

    const post = await prisma.post.create({
      data: {
        userId: user.sub,
        businessId,
        contentText,
        contentType,
      },
      include: {
        business: { select: { id: true, name: true } },
        media: true,
      },
    });

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
