import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

const VALID_EVENTS = ['post.published', 'post.failed', 'analytics.threshold', 'trend.viral'];

// GET /api/v1/developer/webhooks/:webhookId
export async function GET(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const user = getAuthUser(request);

    const webhook = await prisma.webhookEndpoint.findFirst({
      where: { id: params.webhookId, userId: user.sub },
      select: {
        id: true,
        url: true,
        events: true,
        status: true,
        description: true,
        failureCount: true,
        lastTriggeredAt: true,
        disabledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!webhook) {
      throw Errors.notFound('Webhook endpoint');
    }

    return NextResponse.json({ data: webhook });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/developer/webhooks/:webhookId
export async function PATCH(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: params.webhookId, userId: user.sub },
    });

    if (!existing) {
      throw Errors.notFound('Webhook endpoint');
    }

    const updateData: Record<string, unknown> = {};

    if (body.url !== undefined) {
      try {
        const parsed = new URL(body.url);
        if (parsed.protocol !== 'https:') {
          throw Errors.validation({ url: 'Webhook URL must use HTTPS' });
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('HTTPS')) throw e;
        throw Errors.validation({ url: 'Must be a valid URL' });
      }
      updateData.url = body.url;
    }

    if (body.events !== undefined) {
      if (!Array.isArray(body.events) || body.events.length === 0) {
        throw Errors.validation({ events: 'Must include at least one event' });
      }
      const invalid = body.events.filter((e: string) => !VALID_EVENTS.includes(e));
      if (invalid.length > 0) {
        throw Errors.validation({ events: `Invalid events: ${invalid.join(', ')}` });
      }
      updateData.events = body.events;
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.status !== undefined) {
      if (!['active', 'paused'].includes(body.status)) {
        throw Errors.validation({ status: 'Status must be active or paused' });
      }
      updateData.status = body.status;
      if (body.status === 'active') {
        updateData.failureCount = 0;
        updateData.disabledAt = null;
      }
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id: params.webhookId },
      data: updateData,
      select: {
        id: true,
        url: true,
        events: true,
        status: true,
        description: true,
        failureCount: true,
        lastTriggeredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/developer/webhooks/:webhookId
export async function DELETE(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const user = getAuthUser(request);

    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: params.webhookId, userId: user.sub },
    });

    if (!existing) {
      throw Errors.notFound('Webhook endpoint');
    }

    await prisma.webhookEndpoint.delete({
      where: { id: params.webhookId },
    });

    return NextResponse.json({ message: 'Webhook endpoint deleted' });
  } catch (error) {
    return errorResponse(error);
  }
}
