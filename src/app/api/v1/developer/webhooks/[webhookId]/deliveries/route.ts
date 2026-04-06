import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/developer/webhooks/:webhookId/deliveries - Delivery log
export async function GET(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const user = getAuthUser(request);

    const webhook = await prisma.webhookEndpoint.findFirst({
      where: { id: params.webhookId, userId: user.sub },
    });

    if (!webhook) {
      throw Errors.notFound('Webhook endpoint');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20', 10), 100);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { endpointId: params.webhookId };
    if (status) {
      where.status = status;
    }

    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where,
        select: {
          id: true,
          event: true,
          status: true,
          httpStatus: true,
          attempts: true,
          nextRetryAt: true,
          deliveredAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.webhookDelivery.count({ where }),
    ]);

    return NextResponse.json({
      data: deliveries,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
