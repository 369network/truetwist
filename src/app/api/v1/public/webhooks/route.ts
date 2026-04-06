import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getApiKeyUser, requireScope } from '@/middleware/api-key';
import { errorResponse, Errors } from '@/lib/errors';

const VALID_EVENTS = ['post.published', 'post.failed', 'analytics.threshold', 'trend.viral'];

// GET /api/v1/public/webhooks - List webhooks (via API key)
export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'read');

    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { userId: apiUser.sub },
      select: {
        id: true,
        url: true,
        events: true,
        status: true,
        description: true,
        failureCount: true,
        lastTriggeredAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: webhooks });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/public/webhooks - Create webhook (via API key)
export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiKeyUser(request);
    requireScope(apiUser, 'admin');

    const body = await request.json();
    const { url, events, description } = body;

    if (!url || typeof url !== 'string') throw Errors.validation({ url: 'URL is required' });

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') throw new Error();
    } catch {
      throw Errors.validation({ url: 'Must be a valid HTTPS URL' });
    }

    if (!Array.isArray(events) || events.length === 0) {
      throw Errors.validation({ events: `At least one event required: ${VALID_EVENTS.join(', ')}` });
    }

    const invalid = events.filter((e: string) => !VALID_EVENTS.includes(e));
    if (invalid.length > 0) {
      throw Errors.validation({ events: `Invalid: ${invalid.join(', ')}` });
    }

    const count = await prisma.webhookEndpoint.count({ where: { userId: apiUser.sub } });
    if (count >= 5) throw Errors.badRequest('Maximum 5 webhook endpoints');

    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const webhook = await prisma.webhookEndpoint.create({
      data: {
        userId: apiUser.sub,
        url,
        secret,
        events,
        description: description || null,
      },
    });

    return NextResponse.json({
      data: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        status: webhook.status,
        secret,
      },
      message: 'Store the signing secret securely.',
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
