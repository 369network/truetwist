export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

const VALID_EVENTS = ['post.published', 'post.failed', 'analytics.threshold', 'trend.viral'];

// GET /api/v1/developer/webhooks - List webhook endpoints
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);

    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { userId: user.sub },
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: webhooks });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/developer/webhooks - Create a webhook endpoint
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    const { url, events, description } = body;

    if (!url || typeof url !== 'string') {
      throw Errors.validation({ url: 'URL is required' });
    }

    try {
      new URL(url);
    } catch {
      throw Errors.validation({ url: 'Must be a valid URL' });
    }

    if (!url.startsWith('https://')) {
      throw Errors.validation({ url: 'Webhook URL must use HTTPS' });
    }

    if (!Array.isArray(events) || events.length === 0) {
      throw Errors.validation({ events: `Must include at least one event: ${VALID_EVENTS.join(', ')}` });
    }

    const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      throw Errors.validation({ events: `Invalid events: ${invalidEvents.join(', ')}. Valid: ${VALID_EVENTS.join(', ')}` });
    }

    // Limit to 5 webhook endpoints per user
    const count = await prisma.webhookEndpoint.count({
      where: { userId: user.sub },
    });

    if (count >= 5) {
      throw Errors.badRequest('Maximum of 5 webhook endpoints allowed.');
    }

    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const webhook = await prisma.webhookEndpoint.create({
      data: {
        userId: user.sub,
        url,
        secret,
        events,
        description: description || null,
      },
      select: {
        id: true,
        url: true,
        events: true,
        status: true,
        description: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      data: {
        ...webhook,
        secret, // Only shown once on creation
      },
      message: 'Store the signing secret securely. It will not be shown again.',
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
