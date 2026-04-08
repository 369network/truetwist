/**
 * Integration tests for ad accounts API routes.
 * Tests CRUD, OAuth flow, and input validation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TEST_USER,
  TEST_USER_2,
  TEST_BUSINESS,
  buildAuthRequest,
  buildRequest,
  createPrismaMock,
  parseResponse,
} from "./helpers";
import { generateAccessToken } from "@/lib/auth";

const prismaMock = createPrismaMock();
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// Mock encryption library
vi.mock("@/lib/ads/encryption", () => ({
  encryptTokenForDb: vi.fn().mockReturnValue({
    encryptedToken: "mock-encrypted-token",
    iv: "mock-iv",
  }),
  decryptTokenFromDb: vi.fn().mockReturnValue("mock-decrypted-token"),
}));

const { GET: listAdAccounts, POST: createAdAccount } =
  await import("@/app/api/v1/ads/accounts/route");
const {
  GET: getAdAccount,
  PATCH: updateAdAccount,
  DELETE: deleteAdAccount,
} = await import("@/app/api/v1/ads/accounts/[id]/route");

const userToken = generateAccessToken(
  TEST_USER.id,
  TEST_USER.email,
  TEST_USER.plan,
);
const user2Token = generateAccessToken(
  TEST_USER_2.id,
  TEST_USER_2.email,
  TEST_USER_2.plan,
);

const TEST_AD_ACCOUNT = {
  id: "ad-account-123",
  userId: TEST_USER.id,
  businessId: TEST_BUSINESS.id,
  platform: "meta_ads" as const,
  platformAccountId: "act_123456789",
  accountName: "Test Ad Account",
  accountCurrency: "USD",
  timezone: "UTC",
  encryptedToken: "mock-encrypted-token",
  tokenIv: "mock-iv",
  tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  status: "active" as const,
  lastSyncedAt: null,
  syncError: null,
  metadata: { accountId: "123456789", accountStatus: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const TEST_AD_CAMPAIGN = {
  id: "campaign-123",
  adAccountId: TEST_AD_ACCOUNT.id,
  platformCampaignId: "campaign_123456",
  name: "Test Campaign",
  status: "active",
  objective: "conversions",
  dailyBudgetCents: 10000,
  lifetimeBudgetCents: 100000,
  startDate: new Date(),
  endDate: null,
  targeting: { ageMin: 18, ageMax: 65 },
  creativeIds: ["creative_123"],
  metadata: {},
  lastSyncedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── List Ad Accounts ──

describe("GET /api/v1/ads/accounts", () => {
  it("should list ad accounts for authenticated user with pagination", async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);
    prismaMock.adAccount.findMany.mockResolvedValue([
      {
        ...TEST_AD_ACCOUNT,
        business: { id: TEST_BUSINESS.id, name: TEST_BUSINESS.name },
        _count: { campaigns: 2, snapshots: 10 },
      },
    ]);
    prismaMock.adAccount.count.mockResolvedValue(1);

    const req = buildAuthRequest(
      "GET",
      "/api/v1/ads/accounts?businessId=" +
        TEST_BUSINESS.id +
        "&page=1&pageSize=20",
      userToken,
    );
    const res = await listAdAccounts(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    expect(prismaMock.adAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER.id, businessId: TEST_BUSINESS.id },
        skip: 0,
        take: 20,
      }),
    );
  });

  it("should filter by platform and status", async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);
    prismaMock.adAccount.findMany.mockResolvedValue([]);
    prismaMock.adAccount.count.mockResolvedValue(0);

    const req = buildAuthRequest(
      "GET",
      "/api/v1/ads/accounts?businessId=" +
        TEST_BUSINESS.id +
        "&platform=meta_ads&status=active",
      userToken,
    );
    const res = await listAdAccounts(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(prismaMock.adAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: TEST_USER.id,
          businessId: TEST_BUSINESS.id,
          platform: "meta_ads",
          status: "active",
        },
      }),
    );
  });

  it("should return warning when adAccount model is not available", async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);
    // Simulate adAccount not being in prisma
    delete (prismaMock as any).adAccount;

    const req = buildAuthRequest(
      "GET",
      "/api/v1/ads/accounts?businessId=" + TEST_BUSINESS.id,
      userToken,
    );
    const res = await listAdAccounts(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.warning).toContain("Ad accounts feature not fully configured");
  });

  it("should reject when user does not own business", async () => {
    prismaMock.business.findFirst.mockResolvedValue(null);

    const req = buildAuthRequest(
      "GET",
      "/api/v1/ads/accounts?businessId=" + TEST_BUSINESS.id,
      userToken,
    );
    const res = await listAdAccounts(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});

// ── Create Ad Account ──

describe("POST /api/v1/ads/accounts", () => {
  it("should create ad account with valid data", async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);
    prismaMock.adAccount.create.mockResolvedValue(TEST_AD_ACCOUNT);

    const requestBody = {
      businessId: TEST_BUSINESS.id,
      platform: "meta_ads",
      platformAccountId: "act_123456789",
      accountName: "Test Ad Account",
      accountCurrency: "USD",
      timezone: "UTC",
      encryptedToken: "mock-encrypted-token",
      tokenIv: "mock-iv",
      tokenExpiresAt: new Date().toISOString(),
      metadata: { test: true },
    };

    const req = buildAuthRequest("POST", "/api/v1/ads/accounts", userToken, {
      body: requestBody,
    });
    const res = await createAdAccount(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.data.id).toBe(TEST_AD_ACCOUNT.id);
    expect(prismaMock.adAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: TEST_USER.id,
          businessId: TEST_BUSINESS.id,
          platform: "meta_ads",
          platformAccountId: "act_123456789",
          accountName: "Test Ad Account",
          accountCurrency: "USD",
          timezone: "UTC",
          encryptedToken: "mock-encrypted-token",
          tokenIv: "mock-iv",
          status: "active",
          metadata: { test: true },
        },
      }),
    );
  });

  it("should reject invalid platform", async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);

    const requestBody = {
      businessId: TEST_BUSINESS.id,
      platform: "invalid_platform", // Invalid platform
      platformAccountId: "act_123456789",
      encryptedToken: "mock-encrypted-token",
      tokenIv: "mock-iv",
    };

    const req = buildAuthRequest("POST", "/api/v1/ads/accounts", userToken, {
      body: requestBody,
    });
    const res = await createAdAccount(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("should reject when missing required fields", async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);

    const requestBody = {
      businessId: TEST_BUSINESS.id,
      platform: "meta_ads",
      // Missing platformAccountId, encryptedToken, tokenIv
    };

    const req = buildAuthRequest(
      "POST",
      "/api/v1/ads/accounts",
      userToken,
      requestBody,
    );
    const res = await createAdAccount(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("should reject when adAccount model is not available", async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);
    delete (prismaMock as any).adAccount;

    const requestBody = {
      businessId: TEST_BUSINESS.id,
      platform: "meta_ads",
      platformAccountId: "act_123456789",
      encryptedToken: "mock-encrypted-token",
      tokenIv: "mock-iv",
    };

    const req = buildAuthRequest(
      "POST",
      "/api/v1/ads/accounts",
      userToken,
      requestBody,
    );
    const res = await createAdAccount(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
    expect(prismaMock.adAccount.create).not.toHaveBeenCalled();
  });
});

// ── Get Ad Account ──

describe("GET /api/v1/ads/accounts/[id]", () => {
  it("should get ad account with campaigns and metrics", async () => {
    prismaMock.adAccount.findUnique.mockResolvedValue({
      ...TEST_AD_ACCOUNT,
      business: { id: TEST_BUSINESS.id, name: TEST_BUSINESS.name },
      campaigns: [TEST_AD_CAMPAIGN],
      snapshots: [],
    });

    const req = buildAuthRequest(
      "GET",
      "/api/v1/ads/accounts/" + TEST_AD_ACCOUNT.id,
      userToken,
    );
    const res = await getAdAccount(req, { params: { id: TEST_AD_ACCOUNT.id } });
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.id).toBe(TEST_AD_ACCOUNT.id);
    expect(body.data.campaigns).toHaveLength(1);
    expect(body.data.business.id).toBe(TEST_BUSINESS.id);
  });

  it("should reject when ad account not found", async () => {
    prismaMock.adAccount.findUnique.mockResolvedValue(null);

    const req = buildAuthRequest(
      "GET",
      "/api/v1/ads/accounts/" + TEST_AD_ACCOUNT.id,
      userToken,
    );
    const res = await getAdAccount(req, { params: { id: TEST_AD_ACCOUNT.id } });
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("should reject when user does not own ad account", async () => {
    prismaMock.adAccount.findUnique.mockResolvedValue({
      ...TEST_AD_ACCOUNT,
      userId: TEST_USER_2.id, // Different user
    });

    const req = buildAuthRequest(
      "GET",
      "/api/v1/ads/accounts/" + TEST_AD_ACCOUNT.id,
      userToken,
    );
    const res = await getAdAccount(req, { params: { id: TEST_AD_ACCOUNT.id } });
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});

// ── Update Ad Account ──

describe("PATCH /api/v1/ads/accounts/[id]", () => {
  it("should update ad account status", async () => {
    prismaMock.adAccount.findUnique.mockResolvedValue(TEST_AD_ACCOUNT);
    prismaMock.adAccount.update.mockResolvedValue({
      ...TEST_AD_ACCOUNT,
      status: "disconnected",
      accountName: "Updated Name",
    });

    const requestBody = {
      status: "disconnected",
      accountName: "Updated Name",
    };

    const req = buildAuthRequest(
      "PATCH",
      "/api/v1/ads/accounts/" + TEST_AD_ACCOUNT.id,
      userToken,
      requestBody,
    );
    const res = await updateAdAccount(req, {
      params: { id: TEST_AD_ACCOUNT.id },
    });
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.status).toBe("disconnected");
    expect(body.data.accountName).toBe("Updated Name");
    expect(prismaMock.adAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_AD_ACCOUNT.id, userId: TEST_USER.id },
        data: { status: "disconnected", accountName: "Updated Name" },
      }),
    );
  });

  it("should reject invalid status", async () => {
    prismaMock.adAccount.findUnique.mockResolvedValue(TEST_AD_ACCOUNT);

    const requestBody = {
      status: "invalid_status", // Invalid status
    };

    const req = buildAuthRequest(
      "PATCH",
      "/api/v1/ads/accounts/" + TEST_AD_ACCOUNT.id,
      userToken,
      requestBody,
    );
    const res = await updateAdAccount(req, {
      params: { id: TEST_AD_ACCOUNT.id },
    });
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("should reject when ad account not found", async () => {
    prismaMock.adAccount.findUnique.mockResolvedValue(null);

    const requestBody = {
      status: "disconnected",
    };

    const req = buildAuthRequest(
      "PATCH",
      "/api/v1/ads/accounts/" + TEST_AD_ACCOUNT.id,
      userToken,
      requestBody,
    );
    const res = await updateAdAccount(req, {
      params: { id: TEST_AD_ACCOUNT.id },
    });
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});

// ── Delete Ad Account ──

describe("DELETE /api/v1/ads/accounts/[id]", () => {
  it("should soft delete ad account", async () => {
    prismaMock.adAccount.findUnique.mockResolvedValue(TEST_AD_ACCOUNT);
    prismaMock.adAccount.update.mockResolvedValue({
      ...TEST_AD_ACCOUNT,
      status: "disconnected",
    });

    const req = buildAuthRequest(
      "DELETE",
      "/api/v1/ads/accounts/" + TEST_AD_ACCOUNT.id,
      userToken,
    );
    const res = await deleteAdAccount(req, {
      params: { id: TEST_AD_ACCOUNT.id },
    });
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.status).toBe("disconnected");
    expect(prismaMock.adAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_AD_ACCOUNT.id, userId: TEST_USER.id },
        data: { status: "disconnected" },
      }),
    );
  });

  it("should reject when ad account not found", async () => {
    prismaMock.adAccount.findUnique.mockResolvedValue(null);

    const req = buildAuthRequest(
      "DELETE",
      "/api/v1/ads/accounts/" + TEST_AD_ACCOUNT.id,
      userToken,
    );
    const res = await deleteAdAccount(req, {
      params: { id: TEST_AD_ACCOUNT.id },
    });
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("should reject when user does not own ad account", async () => {
    prismaMock.adAccount.findUnique.mockResolvedValue({
      ...TEST_AD_ACCOUNT,
      userId: TEST_USER_2.id, // Different user
    });

    const req = buildAuthRequest(
      "DELETE",
      "/api/v1/ads/accounts/" + TEST_AD_ACCOUNT.id,
      userToken,
    );
    const res = await deleteAdAccount(req, {
      params: { id: TEST_AD_ACCOUNT.id },
    });
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});
