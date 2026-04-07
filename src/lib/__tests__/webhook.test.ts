import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock prisma before importing the module under test
vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEndpoint: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    webhookDelivery: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock global fetch used inside attemptDelivery
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { dispatchWebhookEvent, retryPendingDeliveries } from '@/lib/webhook';
import { prisma } from '@/lib/prisma';

// Re-implement the private helper for direct testing
function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

const mockPrisma = vi.mocked(prisma);

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeEndpoint(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ep-1',
    userId: 'user-1',
    url: 'https://example.com/hook',
    secret: 'test-secret',
    events: ['post.published', 'post.failed'],
    status: 'active',
    attempts: 0,
    maxAttempts: 5,
    failureCount: 0,
    lastTriggeredAt: null,
    disabledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDelivery(overrides: Record<string, unknown> = {}) {
  return {
    id: 'del-1',
    endpointId: 'ep-1',
    event: 'post.published',
    payload: { event: 'post.published', timestamp: new Date().toISOString(), data: {} },
    status: 'retrying',
    httpStatus: null,
    responseBody: null,
    attempts: 2,
    maxAttempts: 5,
    nextRetryAt: new Date(Date.now() - 1000), // already due
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    endpoint: makeEndpoint(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// signPayload (private helper — reimplemented above)
// ---------------------------------------------------------------------------

describe('signPayload', () => {
  it('produces the correct HMAC-SHA256 hex digest', () => {
    const payload = '{"event":"post.published"}';
    const secret = 'my-secret';
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    expect(signPayload(payload, secret)).toBe(expected);
  });

  it('produces a 64-character hex string', () => {
    const sig = signPayload('hello world', 'secret');
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[0-9a-f]+$/);
  });

  it('produces a different signature when the secret differs', () => {
    const payload = '{"event":"post.published"}';
    const sig1 = signPayload(payload, 'secret-a');
    const sig2 = signPayload(payload, 'secret-b');
    expect(sig1).not.toBe(sig2);
  });

  it('produces a different signature when the payload differs', () => {
    const secret = 'shared-secret';
    const sig1 = signPayload('payload-one', secret);
    const sig2 = signPayload('payload-two', secret);
    expect(sig1).not.toBe(sig2);
  });

  it('is deterministic — same inputs always yield the same output', () => {
    const payload = 'deterministic-payload';
    const secret = 'deterministic-secret';
    expect(signPayload(payload, secret)).toBe(signPayload(payload, secret));
  });
});

// ---------------------------------------------------------------------------
// dispatchWebhookEvent
// ---------------------------------------------------------------------------

describe('dispatchWebhookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: processDeliveriesForUser's inner findMany returns nothing
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([]);
  });

  it('returns early without creating deliveries when no active endpoints exist', async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([]);

    await dispatchWebhookEvent('user-1', 'post.published', { postId: 'p1' });

    expect(mockPrisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'active' },
    });
    expect(mockPrisma.webhookDelivery.create).not.toHaveBeenCalled();
  });

  it('returns early without creating deliveries when no endpoints subscribe to the event', async () => {
    // Endpoint only listens to 'analytics.threshold', not 'post.published'
    const endpoint = makeEndpoint({ events: ['analytics.threshold'] });
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([endpoint] as any);

    await dispatchWebhookEvent('user-1', 'post.published', { postId: 'p1' });

    expect(mockPrisma.webhookDelivery.create).not.toHaveBeenCalled();
  });

  it('creates a delivery record for each matching endpoint', async () => {
    const ep1 = makeEndpoint({ id: 'ep-1', events: ['post.published'] });
    const ep2 = makeEndpoint({ id: 'ep-2', events: ['post.published', 'trend.viral'] });
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([ep1, ep2] as any);
    mockPrisma.webhookDelivery.create.mockResolvedValue({ id: 'del-new' } as any);

    await dispatchWebhookEvent('user-1', 'post.published', { postId: 'p1' });

    expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledTimes(2);
  });

  it('creates delivery with correct shape — pending status and matching event', async () => {
    const endpoint = makeEndpoint({ id: 'ep-1', events: ['post.published'] });
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([endpoint] as any);
    mockPrisma.webhookDelivery.create.mockResolvedValue({ id: 'del-new' } as any);

    await dispatchWebhookEvent('user-1', 'post.published', { postId: 'p42' });

    const createCall = mockPrisma.webhookDelivery.create.mock.calls[0][0];
    expect(createCall.data.endpointId).toBe('ep-1');
    expect(createCall.data.event).toBe('post.published');
    expect(createCall.data.status).toBe('pending');
    expect(createCall.data.payload).toMatchObject({
      event: 'post.published',
      data: { postId: 'p42' },
    });
    expect(typeof createCall.data.payload.timestamp).toBe('string');
  });

  it('does not create delivery for endpoint that does not match the event', async () => {
    const matching = makeEndpoint({ id: 'ep-match', events: ['post.published'] });
    const nonMatching = makeEndpoint({ id: 'ep-no', events: ['analytics.threshold'] });
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([matching, nonMatching] as any);
    mockPrisma.webhookDelivery.create.mockResolvedValue({ id: 'del-new' } as any);

    await dispatchWebhookEvent('user-1', 'post.published', {});

    expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.webhookDelivery.create.mock.calls[0][0].data.endpointId).toBe('ep-match');
  });

  it('queries only the active endpoints for the given userId', async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([]);

    await dispatchWebhookEvent('user-xyz', 'trend.viral', {});

    expect(mockPrisma.webhookEndpoint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-xyz', status: 'active' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// retryPendingDeliveries
// ---------------------------------------------------------------------------

describe('retryPendingDeliveries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when there are no retrying deliveries', async () => {
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([]);

    const count = await retryPendingDeliveries();

    expect(count).toBe(0);
    expect(mockPrisma.webhookDelivery.findMany).toHaveBeenCalledOnce();
  });

  it('queries retrying deliveries with nextRetryAt <= now and active endpoint', async () => {
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([]);

    await retryPendingDeliveries();

    const query = mockPrisma.webhookDelivery.findMany.mock.calls[0][0];
    expect(query.where.status).toBe('retrying');
    expect(query.where.endpoint).toMatchObject({ status: 'active' });
    expect(query.where.nextRetryAt).toHaveProperty('lte');
  });

  it('returns the number of deliveries that were processed', async () => {
    const deliveries = [
      makeDelivery({ id: 'del-1' }),
      makeDelivery({ id: 'del-2' }),
    ];
    mockPrisma.webhookDelivery.findMany.mockResolvedValue(deliveries as any);

    // attemptDelivery calls findUnique then update — mock them to succeed
    mockPrisma.webhookDelivery.findUnique
      .mockResolvedValueOnce(makeDelivery({ id: 'del-1' }) as any)
      .mockResolvedValueOnce(makeDelivery({ id: 'del-2' }) as any);

    const successResponse = { ok: true, status: 200, text: () => Promise.resolve('OK') };
    mockFetch.mockResolvedValue(successResponse);

    mockPrisma.webhookDelivery.update.mockResolvedValue({} as any);
    mockPrisma.webhookEndpoint.update.mockResolvedValue({ failureCount: 0 } as any);

    const count = await retryPendingDeliveries();

    expect(count).toBe(2);
  });

  it('attempts delivery for each pending item and marks them delivered on HTTP 2xx', async () => {
    const delivery = makeDelivery({ id: 'del-1', attempts: 1 });
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([delivery] as any);
    mockPrisma.webhookDelivery.findUnique.mockResolvedValue(delivery as any);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{"status":"ok"}'),
    });
    mockPrisma.webhookDelivery.update.mockResolvedValue({} as any);
    mockPrisma.webhookEndpoint.update.mockResolvedValue({ failureCount: 0 } as any);

    await retryPendingDeliveries();

    const updateCall = mockPrisma.webhookDelivery.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('delivered');
    expect(updateCall.data.httpStatus).toBe(200);
  });

  it('marks a delivery as retrying (not failed) when attempts are below maxAttempts and response is non-2xx', async () => {
    const delivery = makeDelivery({ id: 'del-1', attempts: 1, maxAttempts: 5 });
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([delivery] as any);
    mockPrisma.webhookDelivery.findUnique.mockResolvedValue(delivery as any);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });
    mockPrisma.webhookDelivery.update.mockResolvedValue({} as any);

    await retryPendingDeliveries();

    const updateCall = mockPrisma.webhookDelivery.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('retrying');
    expect(updateCall.data.httpStatus).toBe(500);
    expect(updateCall.data.nextRetryAt).toBeInstanceOf(Date);
  });

  it('marks a delivery as failed when attempts reach maxAttempts', async () => {
    // attempts will be incremented to maxAttempts (5) inside handleDeliveryFailure
    const delivery = makeDelivery({ id: 'del-1', attempts: 4, maxAttempts: 5 });
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([delivery] as any);
    mockPrisma.webhookDelivery.findUnique.mockResolvedValue(delivery as any);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    });
    mockPrisma.webhookDelivery.update.mockResolvedValue({} as any);
    mockPrisma.webhookEndpoint.update.mockResolvedValue({ failureCount: 1 } as any);

    await retryPendingDeliveries();

    const updateCall = mockPrisma.webhookDelivery.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('failed');
  });
});
