import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export type WebhookEvent =
  | 'post.published'
  | 'post.failed'
  | 'analytics.threshold'
  | 'trend.viral';

interface WebhookPayloadData {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

const RETRY_DELAYS = [0, 60, 300, 900, 3600]; // 0s, 1m, 5m, 15m, 1hr

export async function dispatchWebhookEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      userId,
      status: 'active',
    },
  });

  const matchingEndpoints = endpoints.filter((ep) => {
    const events = ep.events as string[];
    return events.includes(event);
  });

  if (matchingEndpoints.length === 0) return;

  const payload: WebhookPayloadData = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  for (const endpoint of matchingEndpoints) {
    await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event,
        payload: JSON.parse(JSON.stringify(payload)),
        status: 'pending',
      },
    });
  }

  // Process deliveries asynchronously
  processDeliveriesForUser(userId).catch(() => {});
}

async function processDeliveriesForUser(userId: string): Promise<void> {
  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: { in: ['pending', 'retrying'] },
      endpoint: { userId, status: 'active' },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: new Date() } },
      ],
    },
    include: { endpoint: true },
    take: 50,
    orderBy: { createdAt: 'asc' },
  });

  for (const delivery of deliveries) {
    await attemptDelivery(delivery.id);
  }
}

async function attemptDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });

  if (!delivery || !delivery.endpoint) return;

  const payloadStr = JSON.stringify(delivery.payload);
  const signature = signPayload(payloadStr, delivery.endpoint.secret);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(delivery.endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TrueTwist-Signature': `sha256=${signature}`,
        'X-TrueTwist-Event': delivery.event,
        'X-TrueTwist-Delivery': delivery.id,
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseBody = await response.text().catch(() => '');

    if (response.ok) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'delivered',
          httpStatus: response.status,
          responseBody: responseBody.slice(0, 1000),
          attempts: { increment: 1 },
          deliveredAt: new Date(),
        },
      });

      await prisma.webhookEndpoint.update({
        where: { id: delivery.endpointId },
        data: { lastTriggeredAt: new Date(), failureCount: 0 },
      });
    } else {
      await handleDeliveryFailure(deliveryId, delivery.attempts + 1, delivery.maxAttempts, delivery.endpointId, response.status, responseBody);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await handleDeliveryFailure(deliveryId, delivery.attempts + 1, delivery.maxAttempts, delivery.endpointId, null, msg);
  }
}

async function handleDeliveryFailure(
  deliveryId: string,
  attempts: number,
  maxAttempts: number,
  endpointId: string,
  httpStatus: number | null,
  responseBody: string
): Promise<void> {
  if (attempts >= maxAttempts) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'failed',
        httpStatus,
        responseBody: responseBody.slice(0, 1000),
        attempts,
      },
    });

    // Increment failure count; disable after 10 consecutive failures
    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: { failureCount: { increment: 1 } },
    });

    if (endpoint.failureCount >= 10) {
      await prisma.webhookEndpoint.update({
        where: { id: endpointId },
        data: { status: 'disabled', disabledAt: new Date() },
      });
    }
  } else {
    const delaySeconds = RETRY_DELAYS[attempts] || 3600;
    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'retrying',
        httpStatus,
        responseBody: responseBody.slice(0, 1000),
        attempts,
        nextRetryAt,
      },
    });
  }
}

export async function retryPendingDeliveries(): Promise<number> {
  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: 'retrying',
      nextRetryAt: { lte: new Date() },
      endpoint: { status: 'active' },
    },
    take: 100,
    orderBy: { nextRetryAt: 'asc' },
  });

  for (const delivery of deliveries) {
    await attemptDelivery(delivery.id);
  }

  return deliveries.length;
}
