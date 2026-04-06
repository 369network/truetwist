import { describe, it, expect } from 'vitest';
import {
  createCompetitorSchema,
  updateCompetitorSchema,
  addCompetitorAccountSchema,
  alertQuerySchema,
  markAlertsReadSchema,
} from '../validations';

describe('createCompetitorSchema', () => {
  it('validates a valid competitor with accounts', () => {
    const result = createCompetitorSchema.safeParse({
      businessId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Competitor Inc',
      websiteUrl: 'https://competitor.com',
      accounts: [
        { platform: 'instagram', handle: 'competitor_ig' },
        { platform: 'twitter', handle: 'competitor_tw', profileUrl: 'https://twitter.com/competitor_tw' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('validates a valid competitor without accounts', () => {
    const result = createCompetitorSchema.safeParse({
      businessId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Competitor Inc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = createCompetitorSchema.safeParse({
      businessId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid businessId', () => {
    const result = createCompetitorSchema.safeParse({
      businessId: 'not-a-uuid',
      name: 'Competitor Inc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid platform', () => {
    const result = createCompetitorSchema.safeParse({
      businessId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Competitor Inc',
      accounts: [{ platform: 'myspace', handle: 'test' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('updateCompetitorSchema', () => {
  it('allows partial updates', () => {
    expect(updateCompetitorSchema.safeParse({ name: 'New Name' }).success).toBe(true);
    expect(updateCompetitorSchema.safeParse({ websiteUrl: 'https://new.com' }).success).toBe(true);
    expect(updateCompetitorSchema.safeParse({}).success).toBe(true);
  });
});

describe('addCompetitorAccountSchema', () => {
  it('validates a valid account', () => {
    const result = addCompetitorAccountSchema.safeParse({
      platform: 'instagram',
      handle: 'test_account',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty handle', () => {
    const result = addCompetitorAccountSchema.safeParse({
      platform: 'instagram',
      handle: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('alertQuerySchema', () => {
  it('validates valid query params', () => {
    const result = alertQuerySchema.safeParse({
      alertType: 'viral_post',
      unreadOnly: 'true',
      limit: '25',
      offset: '0',
    });
    expect(result.success).toBe(true);
  });

  it('allows empty params', () => {
    expect(alertQuerySchema.safeParse({}).success).toBe(true);
  });

  it('rejects invalid alert type', () => {
    const result = alertQuerySchema.safeParse({ alertType: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('markAlertsReadSchema', () => {
  it('validates valid alert IDs', () => {
    const result = markAlertsReadSchema.safeParse({
      alertIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty array', () => {
    const result = markAlertsReadSchema.safeParse({ alertIds: [] });
    expect(result.success).toBe(false);
  });
});
