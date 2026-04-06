/**
 * Integration tests for posts API routes.
 * Tests CRUD operations, authorization, and input validation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TEST_USER,
  TEST_USER_2,
  TEST_BUSINESS,
  TEST_POST,
  buildAuthRequest,
  createPrismaMock,
  parseResponse,
} from './helpers';
import { generateAccessToken } from '@/lib/auth';

// ── Mocks ──

const prismaMock = createPrismaMock();
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/middleware/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ remaining: 5, reset: Date.now() + 60000 }),
  getRateLimitForPlan: vi.fn().mockReturnValue(60),
}));

const { GET: listPosts, POST: createPost } = await import('@/app/api/v1/posts/route');
const { GET: getPost, PATCH: updatePost, DELETE: deletePost } = await import('@/app/api/v1/posts/[id]/route');

const userToken = generateAccessToken(TEST_USER.id, TEST_USER.email, TEST_USER.plan);
const user2Token = generateAccessToken(TEST_USER_2.id, TEST_USER_2.email, TEST_USER_2.plan);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── List Posts ──

describe('GET /api/v1/posts', () => {
  it('should list posts for authenticated user', async () => {
    const posts = [{ ...TEST_POST, business: { id: TEST_BUSINESS.id, name: TEST_BUSINESS.name }, media: [], schedules: [] }];
    prismaMock.post.findMany.mockResolvedValue(posts);
    prismaMock.post.count.mockResolvedValue(1);

    const req = buildAuthRequest('GET', '/api/v1/posts', userToken);
    const res = await listPosts(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    // Verify the query filtered by userId
    expect(prismaMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: TEST_USER.id }),
      })
    );
  });

  it('should reject unauthenticated request', async () => {
    const { buildRequest } = await import('./helpers');
    const req = buildRequest('GET', '/api/v1/posts');
    const res = await listPosts(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it('should filter by businessId with ownership check', async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);
    prismaMock.post.findMany.mockResolvedValue([]);
    prismaMock.post.count.mockResolvedValue(0);

    const req = buildAuthRequest('GET', `/api/v1/posts?businessId=${TEST_BUSINESS.id}`, userToken);
    const res = await listPosts(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    // Verify business ownership was checked
    expect(prismaMock.business.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_BUSINESS.id, userId: TEST_USER.id },
      })
    );
  });

  it('should return 404 when filtering by non-owned business', async () => {
    prismaMock.business.findFirst.mockResolvedValue(null);

    const req = buildAuthRequest('GET', `/api/v1/posts?businessId=other-biz`, userToken);
    const res = await listPosts(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ── Create Post ──

describe('POST /api/v1/posts', () => {
  it('should create a post for owned business', async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);
    const createdPost = {
      ...TEST_POST,
      id: 'new-post-id',
      business: { id: TEST_BUSINESS.id, name: TEST_BUSINESS.name },
      media: [],
    };
    prismaMock.post.create.mockResolvedValue(createdPost);

    const req = buildAuthRequest('POST', '/api/v1/posts', userToken, {
      body: {
        businessId: TEST_BUSINESS.id,
        contentText: 'New post content',
        contentType: 'text',
      },
    });

    const res = await createPost(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.data.id).toBe('new-post-id');
    // Verify ownership check
    expect(prismaMock.business.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_BUSINESS.id, userId: TEST_USER.id },
      })
    );
  });

  it('should reject creating post for non-owned business', async () => {
    prismaMock.business.findFirst.mockResolvedValue(null);

    const req = buildAuthRequest('POST', '/api/v1/posts', userToken, {
      body: {
        businessId: 'f1e2d3c4-b5a6-4978-8d9e-0f1a2b3c4d5e',
        contentText: 'Sneaky post',
        contentType: 'text',
      },
    });

    const res = await createPost(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it('should reject invalid content type', async () => {
    const req = buildAuthRequest('POST', '/api/v1/posts', userToken, {
      body: {
        businessId: TEST_BUSINESS.id,
        contentText: 'Content',
        contentType: 'invalid_type',
      },
    });

    const res = await createPost(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(422);
  });

  it('should reject invalid businessId format', async () => {
    const req = buildAuthRequest('POST', '/api/v1/posts', userToken, {
      body: {
        businessId: 'not-a-uuid',
        contentText: 'Content',
      },
    });

    const res = await createPost(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(422);
  });
});

// ── Get Single Post ──

describe('GET /api/v1/posts/:id', () => {
  const params = { id: TEST_POST.id };

  it('should return post owned by authenticated user', async () => {
    const fullPost = {
      ...TEST_POST,
      business: { id: TEST_BUSINESS.id, name: TEST_BUSINESS.name },
      media: [],
      schedules: [],
    };
    prismaMock.post.findFirst.mockResolvedValue(fullPost);

    const req = buildAuthRequest('GET', `/api/v1/posts/${TEST_POST.id}`, userToken);
    const res = await getPost(req, { params });
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.id).toBe(TEST_POST.id);
    // Verify userId filter was applied
    expect(prismaMock.post.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_POST.id, userId: TEST_USER.id },
      })
    );
  });

  it('should return 404 for non-owned post (IDOR protection)', async () => {
    prismaMock.post.findFirst.mockResolvedValue(null);

    const req = buildAuthRequest('GET', `/api/v1/posts/${TEST_POST.id}`, user2Token);
    const res = await getPost(req, { params });
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});

// ── Update Post ──

describe('PATCH /api/v1/posts/:id', () => {
  const params = { id: TEST_POST.id };

  it('should update a draft post', async () => {
    prismaMock.post.findFirst.mockResolvedValue({ ...TEST_POST, status: 'draft' });
    prismaMock.post.update.mockResolvedValue({
      ...TEST_POST,
      contentText: 'Updated!',
      business: { id: TEST_BUSINESS.id, name: TEST_BUSINESS.name },
      media: [],
    });

    const req = buildAuthRequest('PATCH', `/api/v1/posts/${TEST_POST.id}`, userToken, {
      body: { contentText: 'Updated!' },
    });

    const res = await updatePost(req, { params });
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.contentText).toBe('Updated!');
  });

  it('should reject update of a "posted" post', async () => {
    prismaMock.post.findFirst.mockResolvedValue({ ...TEST_POST, status: 'posted' });

    const req = buildAuthRequest('PATCH', `/api/v1/posts/${TEST_POST.id}`, userToken, {
      body: { contentText: 'Trying to edit published post' },
    });

    const res = await updatePost(req, { params });
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error.error).toContain('draft');
  });

  it('should reject update of a "posting" post', async () => {
    prismaMock.post.findFirst.mockResolvedValue({ ...TEST_POST, status: 'posting' });

    const req = buildAuthRequest('PATCH', `/api/v1/posts/${TEST_POST.id}`, userToken, {
      body: { contentText: 'Mid-publish edit attempt' },
    });

    const res = await updatePost(req, { params });
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});

// ── Delete Post ──

describe('DELETE /api/v1/posts/:id', () => {
  const params = { id: TEST_POST.id };

  it('should delete a draft post', async () => {
    prismaMock.post.findFirst.mockResolvedValue({ ...TEST_POST, status: 'draft' });
    prismaMock.post.delete.mockResolvedValue(TEST_POST);

    const req = buildAuthRequest('DELETE', `/api/v1/posts/${TEST_POST.id}`, userToken);
    const res = await deletePost(req, { params });
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.message).toBe('Post deleted.');
  });

  it('should reject deleting a "posting" post', async () => {
    prismaMock.post.findFirst.mockResolvedValue({ ...TEST_POST, status: 'posting' });

    const req = buildAuthRequest('DELETE', `/api/v1/posts/${TEST_POST.id}`, userToken);
    const res = await deletePost(req, { params });
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it('should return 404 for non-owned post', async () => {
    prismaMock.post.findFirst.mockResolvedValue(null);

    const req = buildAuthRequest('DELETE', `/api/v1/posts/${TEST_POST.id}`, user2Token);
    const res = await deletePost(req, { params });
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});
