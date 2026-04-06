/**
 * E2E User Journey Tests
 *
 * Tests complete user flows through the API:
 * 1. Signup → Onboarding → Create Content → Schedule → Post
 * 2. Auth edge cases: token rotation, expired tokens
 * 3. Business management lifecycle
 * 4. Content creation and scheduling workflow
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TEST_USER,
  TEST_BUSINESS,
  TEST_POST,
  TEST_SOCIAL_ACCOUNT,
  buildRequest,
  buildAuthRequest,
  createPrismaMock,
  parseResponse,
} from './helpers';

// ── Mocks ──

const prismaMock = createPrismaMock();
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/email', () => ({ sendWelcomeEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/middleware/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ remaining: 5, reset: Date.now() + 60000 }),
  getRateLimitForPlan: vi.fn().mockReturnValue(60),
}));

// Import all route handlers
const { POST: register } = await import('@/app/api/v1/auth/register/route');
const { POST: login } = await import('@/app/api/v1/auth/login/route');
const { POST: refresh } = await import('@/app/api/v1/auth/refresh/route');
const { GET: getProfile } = await import('@/app/api/v1/users/me/route');
const { GET: listBusinesses, POST: createBusiness } = await import('@/app/api/v1/businesses/route');
const { GET: listPosts, POST: createPost } = await import('@/app/api/v1/posts/route');
const { GET: getPost, PATCH: updatePost, DELETE: deletePost } = await import('@/app/api/v1/posts/[id]/route');
const { POST: schedulePost } = await import('@/app/api/v1/posts/[id]/schedule/route');

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Journey 1: Signup → Onboarding → Create Content → Schedule ──

describe('User Journey: Signup to Scheduled Post', () => {
  it('should complete full signup → business → post → schedule flow', async () => {
    // Step 1: Register
    prismaMock.user.findUnique.mockResolvedValueOnce(null); // no existing user
    const createdUser = {
      id: 'journey-user-1',
      email: 'journey@example.com',
      name: 'Journey User',
      plan: 'free',
      avatarUrl: null,
      onboardingCompleted: false,
      createdAt: new Date(),
    };
    prismaMock.user.create.mockResolvedValueOnce(createdUser);
    prismaMock.refreshToken.create.mockResolvedValue({});

    const registerReq = buildRequest('POST', '/api/v1/auth/register', {
      body: { email: 'journey@example.com', password: 'JourneyPass1', name: 'Journey User' },
    });

    const registerRes = await register(registerReq);
    const { status: regStatus, body: regBody } = await parseResponse(registerRes);

    expect(regStatus).toBe(201);
    const accessToken = regBody.data.accessToken;
    expect(accessToken).toBeTruthy();

    // Step 2: Get profile (verify token works)
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...createdUser,
      provider: 'email',
      updatedAt: new Date(),
      subscription: null,
    });

    const profileReq = buildAuthRequest('GET', '/api/v1/users/me', accessToken);
    const profileRes = await getProfile(profileReq);
    const { status: profileStatus, body: profileBody } = await parseResponse(profileRes);

    expect(profileStatus).toBe(200);
    expect(profileBody.data.email).toBe('journey@example.com');
    expect(profileBody.data.onboardingCompleted).toBe(false);

    // Step 3: Create business (completes onboarding)
    const createdBiz = {
      id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
      userId: 'journey-user-1',
      name: 'Journey Corp',
      industry: 'saas',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaMock.business.create.mockResolvedValueOnce(createdBiz);
    prismaMock.business.count.mockResolvedValueOnce(1); // first business
    prismaMock.user.update.mockResolvedValueOnce({});

    const bizReq = buildAuthRequest('POST', '/api/v1/businesses', accessToken, {
      body: { name: 'Journey Corp', industry: 'saas' },
    });

    const bizRes = await createBusiness(bizReq);
    const { status: bizStatus } = await parseResponse(bizRes);

    expect(bizStatus).toBe(201);
    // Onboarding should be marked complete
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { onboardingCompleted: true } })
    );

    // Step 4: Create a post
    prismaMock.business.findFirst.mockResolvedValueOnce(createdBiz);
    const createdPost = {
      id: 'journey-post-1',
      userId: 'journey-user-1',
      businessId: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
      contentText: 'Launching our product today!',
      contentType: 'text',
      status: 'draft',
      business: { id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f', name: 'Journey Corp' },
      media: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaMock.post.create.mockResolvedValueOnce(createdPost);

    const postReq = buildAuthRequest('POST', '/api/v1/posts', accessToken, {
      body: {
        businessId: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
        contentText: 'Launching our product today!',
        contentType: 'text',
      },
    });

    const postRes = await createPost(postReq);
    const { status: postStatus, body: postBody } = await parseResponse(postRes);

    expect(postStatus).toBe(201);
    expect(postBody.data.contentText).toBe('Launching our product today!');

    // Step 5: Schedule the post
    prismaMock.post.findFirst.mockResolvedValueOnce(createdPost);
    prismaMock.socialAccount.findFirst.mockResolvedValueOnce({
      ...TEST_SOCIAL_ACCOUNT,
      userId: 'journey-user-1',
    });
    const scheduleData = {
      id: 'schedule-1',
      postId: 'journey-post-1',
      socialAccountId: TEST_SOCIAL_ACCOUNT.id,
      platform: 'twitter',
      scheduledAt: new Date('2026-04-10T10:00:00Z'),
      status: 'scheduled',
      socialAccount: {
        id: TEST_SOCIAL_ACCOUNT.id,
        platform: 'twitter',
        accountName: 'Test Account',
        accountHandle: '@testco',
      },
    };
    prismaMock.postSchedule.create.mockResolvedValueOnce(scheduleData);
    prismaMock.post.update.mockResolvedValueOnce({ ...createdPost, status: 'scheduled' });

    const schedReq = buildAuthRequest('POST', '/api/v1/posts/journey-post-1/schedule', accessToken, {
      body: {
        socialAccountId: TEST_SOCIAL_ACCOUNT.id,
        platform: 'twitter',
        scheduledAt: '2026-04-10T10:00:00Z',
      },
    });

    const schedRes = await schedulePost(schedReq, { params: { id: 'journey-post-1' } });
    const { status: schedStatus, body: schedBody } = await parseResponse(schedRes);

    expect(schedStatus).toBe(201);
    expect(schedBody.data.platform).toBe('twitter');
    expect(schedBody.data.status).toBe('scheduled');

    // Post status should have been updated to 'scheduled'
    expect(prismaMock.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'journey-post-1' },
        data: { status: 'scheduled' },
      })
    );
  });
});

// ── Journey 2: Auth Token Lifecycle ──

describe('User Journey: Token Rotation', () => {
  it('should login, use access token, rotate via refresh, and use new token', async () => {
    const { hashPassword, generateRefreshToken, hashToken } = await import('@/lib/auth');
    const hash = await hashPassword('TestPass1');

    // Step 1: Login
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...TEST_USER,
      hashedPassword: hash,
    });
    prismaMock.refreshToken.create.mockResolvedValue({});

    const loginReq = buildRequest('POST', '/api/v1/auth/login', {
      body: { email: TEST_USER.email, password: 'TestPass1' },
    });

    const loginRes = await login(loginReq);
    const { status: loginStatus, body: loginBody } = await parseResponse(loginRes);

    expect(loginStatus).toBe(200);
    const firstAccessToken = loginBody.data.accessToken;
    const firstRefreshToken = loginBody.data.refreshToken;

    // Step 2: Use access token to get profile
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...TEST_USER,
      subscription: null,
    });

    const profileReq = buildAuthRequest('GET', '/api/v1/users/me', firstAccessToken);
    const profileRes = await getProfile(profileReq);
    expect(profileRes.status).toBe(200);

    // Step 3: Refresh the token
    const { verifyRefreshToken } = await import('@/lib/auth');
    const payload = verifyRefreshToken(firstRefreshToken);

    prismaMock.refreshToken.findUnique.mockResolvedValueOnce({
      id: payload.jti,
      userId: TEST_USER.id,
      tokenHash: hashToken(firstRefreshToken),
      expiresAt: new Date(Date.now() + 7 * 86400000),
      revokedAt: null,
      replacedBy: null,
    });

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: TEST_USER.id,
      email: TEST_USER.email,
      plan: TEST_USER.plan,
    });

    prismaMock.$transaction.mockImplementation(async (fns: unknown[]) => {
      if (Array.isArray(fns)) return fns;
      return [];
    });

    const refreshReq = buildRequest('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: firstRefreshToken },
    });

    const refreshRes = await refresh(refreshReq);
    const { status: refreshStatus, body: refreshBody } = await parseResponse(refreshRes);

    expect(refreshStatus).toBe(200);
    expect(refreshBody.data.accessToken).toBeTruthy();
    expect(refreshBody.data.refreshToken).not.toBe(firstRefreshToken);

    // Step 4: Use new access token
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...TEST_USER,
      subscription: null,
    });

    const newProfileReq = buildAuthRequest('GET', '/api/v1/users/me', refreshBody.data.accessToken);
    const newProfileRes = await getProfile(newProfileReq);
    expect(newProfileRes.status).toBe(200);
  });
});

// ── Journey 3: Content Lifecycle ──

describe('User Journey: Content Create → Edit → Delete', () => {
  it('should create, update, and delete a post', async () => {
    const { generateAccessToken } = await import('@/lib/auth');
    const token = generateAccessToken(TEST_USER.id, TEST_USER.email, TEST_USER.plan);

    // Create
    prismaMock.business.findFirst.mockResolvedValueOnce(TEST_BUSINESS);
    const post = {
      ...TEST_POST,
      id: 'lifecycle-post',
      business: { id: TEST_BUSINESS.id, name: TEST_BUSINESS.name },
      media: [],
    };
    prismaMock.post.create.mockResolvedValueOnce(post);

    const createReq = buildAuthRequest('POST', '/api/v1/posts', token, {
      body: { businessId: TEST_BUSINESS.id, contentText: 'Original', contentType: 'text' },
    });
    const createRes = await createPost(createReq);
    expect(createRes.status).toBe(201);

    // Update
    prismaMock.post.findFirst.mockResolvedValueOnce({ ...post, status: 'draft' });
    prismaMock.post.update.mockResolvedValueOnce({
      ...post,
      contentText: 'Edited content',
    });

    const updateReq = buildAuthRequest('PATCH', '/api/v1/posts/lifecycle-post', token, {
      body: { contentText: 'Edited content' },
    });
    const updateRes = await updatePost(updateReq, { params: { id: 'lifecycle-post' } });
    const { status: updateStatus, body: updateBody } = await parseResponse(updateRes);

    expect(updateStatus).toBe(200);
    expect(updateBody.data.contentText).toBe('Edited content');

    // Delete
    prismaMock.post.findFirst.mockResolvedValueOnce({ ...post, status: 'draft' });
    prismaMock.post.delete.mockResolvedValueOnce(post);

    const deleteReq = buildAuthRequest('DELETE', '/api/v1/posts/lifecycle-post', token);
    const deleteRes = await deletePost(deleteReq, { params: { id: 'lifecycle-post' } });
    expect(deleteRes.status).toBe(200);
  });
});

// ── Journey 4: Cross-User Isolation ──

describe('User Journey: Cross-User Data Isolation', () => {
  it('should prevent user B from accessing user A resources', async () => {
    const { generateAccessToken } = await import('@/lib/auth');
    const tokenA = generateAccessToken(TEST_USER.id, TEST_USER.email, TEST_USER.plan);
    const tokenB = generateAccessToken('attacker-id', 'attacker@example.com', 'free');

    // User A creates a business
    prismaMock.business.create.mockResolvedValueOnce(TEST_BUSINESS);
    prismaMock.business.count.mockResolvedValueOnce(1);
    prismaMock.user.update.mockResolvedValueOnce({});

    const createBizReq = buildAuthRequest('POST', '/api/v1/businesses', tokenA, {
      body: { name: 'Secret Biz' },
    });
    const createBizRes = await createBusiness(createBizReq);
    expect(createBizRes.status).toBe(201);

    // User B tries to view user A's business
    prismaMock.business.findFirst.mockResolvedValueOnce(null); // ownership check fails

    const getBizReq = buildAuthRequest('GET', `/api/v1/businesses/${TEST_BUSINESS.id}`, tokenB);
    const { GET: getBiz } = await import('@/app/api/v1/businesses/[id]/route');
    const getBizRes = await getBiz(getBizReq, { params: { id: TEST_BUSINESS.id } });
    expect(getBizRes.status).toBe(404);

    // User B tries to create post on user A's business
    prismaMock.business.findFirst.mockResolvedValueOnce(null); // ownership check fails

    const createPostReq = buildAuthRequest('POST', '/api/v1/posts', tokenB, {
      body: { businessId: TEST_BUSINESS.id, contentText: 'Hacked!', contentType: 'text' },
    });
    const createPostRes = await createPost(createPostReq);
    expect(createPostRes.status).toBe(404);

    // User B tries to schedule on user A's post
    prismaMock.post.findFirst.mockResolvedValueOnce(null); // ownership check fails

    const schedReq = buildAuthRequest('POST', `/api/v1/posts/${TEST_POST.id}/schedule`, tokenB, {
      body: {
        socialAccountId: TEST_SOCIAL_ACCOUNT.id,
        platform: 'twitter',
        scheduledAt: '2026-04-10T10:00:00Z',
      },
    });
    const schedRes = await schedulePost(schedReq, { params: { id: TEST_POST.id } });
    expect(schedRes.status).toBe(404);
  });
});
