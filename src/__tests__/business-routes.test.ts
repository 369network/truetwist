/**
 * Integration tests for businesses API routes.
 * Tests CRUD, ownership isolation, and input validation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TEST_USER,
  TEST_USER_2,
  TEST_BUSINESS,
  buildAuthRequest,
  buildRequest,
  createPrismaMock,
  parseResponse,
} from './helpers';
import { generateAccessToken } from '@/lib/auth';

const prismaMock = createPrismaMock();
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const { GET: listBusinesses, POST: createBusiness } = await import('@/app/api/v1/businesses/route');
const { GET: getBusiness, PATCH: updateBusiness, DELETE: deleteBusiness } = await import('@/app/api/v1/businesses/[id]/route');

const userToken = generateAccessToken(TEST_USER.id, TEST_USER.email, TEST_USER.plan);
const user2Token = generateAccessToken(TEST_USER_2.id, TEST_USER_2.email, TEST_USER_2.plan);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── List Businesses ──

describe('GET /api/v1/businesses', () => {
  it('should list businesses for authenticated user only', async () => {
    prismaMock.business.findMany.mockResolvedValue([{ ...TEST_BUSINESS, _count: { competitors: 0, posts: 5 } }]);

    const req = buildAuthRequest('GET', '/api/v1/businesses', userToken);
    const res = await listBusinesses(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(prismaMock.business.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER.id },
      })
    );
  });

  it('should return empty list for user with no businesses', async () => {
    prismaMock.business.findMany.mockResolvedValue([]);

    const req = buildAuthRequest('GET', '/api/v1/businesses', user2Token);
    const res = await listBusinesses(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  it('should reject unauthenticated request', async () => {
    const req = buildRequest('GET', '/api/v1/businesses');
    const res = await listBusinesses(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });
});

// ── Create Business ──

describe('POST /api/v1/businesses', () => {
  it('should create a business and mark onboarding complete on first', async () => {
    prismaMock.business.create.mockResolvedValue({ ...TEST_BUSINESS, id: 'new-biz' });
    prismaMock.business.count.mockResolvedValue(1); // first business
    prismaMock.user.update.mockResolvedValue({});

    const req = buildAuthRequest('POST', '/api/v1/businesses', userToken, {
      body: { name: 'My New Biz', industry: 'tech' },
    });

    const res = await createBusiness(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.data.name).toBe('Test Co');
    // Should have marked onboarding completed since count = 1
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_USER.id },
        data: { onboardingCompleted: true },
      })
    );
  });

  it('should not mark onboarding on second business', async () => {
    prismaMock.business.create.mockResolvedValue({ ...TEST_BUSINESS, id: 'biz-2' });
    prismaMock.business.count.mockResolvedValue(2);

    const req = buildAuthRequest('POST', '/api/v1/businesses', userToken, {
      body: { name: 'Second Biz' },
    });

    const res = await createBusiness(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(201);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('should reject missing name', async () => {
    const req = buildAuthRequest('POST', '/api/v1/businesses', userToken, {
      body: { industry: 'tech' },
    });

    const res = await createBusiness(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(422);
  });

  it('should reject invalid color format', async () => {
    const req = buildAuthRequest('POST', '/api/v1/businesses', userToken, {
      body: {
        name: 'Color Test',
        colors: { primary: 'not-a-color', secondary: '#000', accent: '#FFF' },
      },
    });

    const res = await createBusiness(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(422);
  });
});

// ── Get Single Business ──

describe('GET /api/v1/businesses/:id', () => {
  const params = { id: TEST_BUSINESS.id };

  it('should return business owned by user', async () => {
    prismaMock.business.findFirst.mockResolvedValue({
      ...TEST_BUSINESS,
      competitors: [],
      _count: { posts: 3 },
    });

    const req = buildAuthRequest('GET', `/api/v1/businesses/${TEST_BUSINESS.id}`, userToken);
    const res = await getBusiness(req, { params });
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.id).toBe(TEST_BUSINESS.id);
  });

  it('should return 404 for non-owned business (IDOR protection)', async () => {
    prismaMock.business.findFirst.mockResolvedValue(null);

    const req = buildAuthRequest('GET', `/api/v1/businesses/${TEST_BUSINESS.id}`, user2Token);
    const res = await getBusiness(req, { params });
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});

// ── Update Business ──

describe('PATCH /api/v1/businesses/:id', () => {
  const params = { id: TEST_BUSINESS.id };

  it('should update owned business', async () => {
    prismaMock.business.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.business.findFirst.mockResolvedValue({ ...TEST_BUSINESS, name: 'Updated Name' });

    const req = buildAuthRequest('PATCH', `/api/v1/businesses/${TEST_BUSINESS.id}`, userToken, {
      body: { name: 'Updated Name' },
    });

    const res = await updateBusiness(req, { params });
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.name).toBe('Updated Name');
  });

  it('should return 404 for non-owned business update', async () => {
    prismaMock.business.updateMany.mockResolvedValue({ count: 0 });

    const req = buildAuthRequest('PATCH', `/api/v1/businesses/${TEST_BUSINESS.id}`, user2Token, {
      body: { name: 'Hacked Name' },
    });

    const res = await updateBusiness(req, { params });
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});

// ── Delete Business ──

describe('DELETE /api/v1/businesses/:id', () => {
  const params = { id: TEST_BUSINESS.id };

  it('should delete owned business', async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);
    prismaMock.business.delete.mockResolvedValue(TEST_BUSINESS);

    const req = buildAuthRequest('DELETE', `/api/v1/businesses/${TEST_BUSINESS.id}`, userToken);
    const res = await deleteBusiness(req, { params });
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.message).toBe('Business deleted.');
  });

  it('should return 404 for non-owned business delete', async () => {
    prismaMock.business.findFirst.mockResolvedValue(null);

    const req = buildAuthRequest('DELETE', `/api/v1/businesses/${TEST_BUSINESS.id}`, user2Token);
    const res = await deleteBusiness(req, { params });
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});
