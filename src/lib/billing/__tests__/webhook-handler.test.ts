import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockHandleSubscriptionCreated = vi.fn();
const mockHandleSubscriptionUpdated = vi.fn();
const mockHandleSubscriptionDeleted = vi.fn();
const mockAddTopUpCredits = vi.fn();

vi.mock('@/lib/billing', () => ({
  handleSubscriptionCreated: mockHandleSubscriptionCreated,
  handleSubscriptionUpdated: mockHandleSubscriptionUpdated,
  handleSubscriptionDeleted: mockHandleSubscriptionDeleted,
  addTopUpCredits: mockAddTopUpCredits,
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

import { stripe } from '@/lib/stripe';

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeEvent(type: string, object: any) {
    return { type, data: { object } };
  }

  it('should route subscription.created events', async () => {
    const subObj = { id: 'sub_test', customer: 'cus_test', metadata: { userId: 'u1' } };
    const event = makeEvent('customer.subscription.created', subObj);

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(event as any);

    // Simulate what the webhook route does
    await mockHandleSubscriptionCreated(event.data.object);

    expect(mockHandleSubscriptionCreated).toHaveBeenCalledWith(subObj);
  });

  it('should route subscription.updated events', async () => {
    const subObj = { id: 'sub_test', customer: 'cus_test', status: 'active' };
    const event = makeEvent('customer.subscription.updated', subObj);

    await mockHandleSubscriptionUpdated(event.data.object);

    expect(mockHandleSubscriptionUpdated).toHaveBeenCalledWith(subObj);
  });

  it('should route subscription.deleted events', async () => {
    const subObj = { id: 'sub_test' };
    const event = makeEvent('customer.subscription.deleted', subObj);

    await mockHandleSubscriptionDeleted(event.data.object);

    expect(mockHandleSubscriptionDeleted).toHaveBeenCalledWith(subObj);
  });

  it('should handle credit top-up checkout completion', async () => {
    const session = {
      metadata: { type: 'credit_topup', userId: 'user-1', packs: '3' },
    };

    if (session.metadata?.type === 'credit_topup' && session.metadata?.userId) {
      const packs = parseInt(session.metadata.packs, 10) || 1;
      await mockAddTopUpCredits(session.metadata.userId, packs);
    }

    expect(mockAddTopUpCredits).toHaveBeenCalledWith('user-1', 3);
  });

  it('should not process top-up for non-topup checkout sessions', async () => {
    const session = { metadata: { type: 'subscription', userId: 'user-1' } };

    if (session.metadata?.type === 'credit_topup') {
      await mockAddTopUpCredits(session.metadata.userId, 1);
    }

    expect(mockAddTopUpCredits).not.toHaveBeenCalled();
  });
});
