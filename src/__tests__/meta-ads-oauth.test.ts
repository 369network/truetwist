/**
 * Integration tests for Meta Ads OAuth flow.
 * Tests OAuth initiation, callback handling, and token exchange.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TEST_USER,
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
vi.mock("@/lib/ads/ad-account-manager", () => ({
  AdAccountManager: {
    exchangeAndEncrypt: vi.fn(),
    getAccountInfo: vi.fn(),
  },
}));

// Mock environment variables
process.env.META_ADS_CLIENT_ID = "test-client-id";
process.env.META_ADS_CLIENT_SECRET = "test-client-secret";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

const { GET: initiateMetaOAuth, POST: initiateMetaOAuthPost } =
  await import("@/app/api/v1/ads/accounts/connect/meta/route");
const { GET: handleMetaCallback } =
  await import("@/app/api/v1/auth/callback/meta-ads/route");

const userToken = generateAccessToken(
  TEST_USER.id,
  TEST_USER.email,
  TEST_USER.plan,
);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset fetch mocks
  global.fetch = vi.fn();
});

// ── OAuth Initiation ──

describe("GET /api/v1/ads/accounts/connect/meta", () => {
  it("should generate OAuth URL with correct parameters", async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);

    const req = buildAuthRequest(
      "GET",
      "/api/v1/ads/accounts/connect/meta?businessId=" + TEST_BUSINESS.id,
      userToken,
    );
    const res = await initiateMetaOAuth(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.oauthUrl).toContain(
      "https://www.facebook.com/v21.0/dialog/oauth",
    );
    expect(body.data.oauthUrl).toContain("client_id=test-client-id");
    expect(body.data.oauthUrl).toContain(
      "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Fauth%2Fcallback%2Fmeta-ads",
    );
    expect(body.data.oauthUrl).toContain(
      "scope=ads_management%2Cads_read%2Cbusiness_management%2Cpages_read_engagement%2Cpages_show_list",
    );
    expect(body.data.oauthUrl).toContain("response_type=code");
    expect(body.data.state).toBeTruthy();
    expect(body.data.business.id).toBe(TEST_BUSINESS.id);
  });

  it("should reject when businessId is missing", async () => {
    const req = buildAuthRequest(
      "GET",
      "/api/v1/ads/accounts/connect/meta",
      userToken,
    );
    const res = await initiateMetaOAuth(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("should reject when user does not own business", async () => {
    prismaMock.business.findFirst.mockResolvedValue(null);

    const req = buildAuthRequest(
      "GET",
      "/api/v1/ads/accounts/connect/meta?businessId=" + TEST_BUSINESS.id,
      userToken,
    );
    const res = await initiateMetaOAuth(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("should reject when Meta Ads integration is not configured", async () => {
    delete process.env.META_ADS_CLIENT_ID;
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);

    const req = buildAuthRequest(
      "GET",
      "/api/v1/ads/accounts/connect/meta?businessId=" + TEST_BUSINESS.id,
      userToken,
    );
    const res = await initiateMetaOAuth(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
    // Restore env var
    process.env.META_ADS_CLIENT_ID = "test-client-id";
  });
});

describe("POST /api/v1/ads/accounts/connect/meta", () => {
  it("should generate OAuth URL with JSON body", async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);

    const requestBody = {
      businessId: TEST_BUSINESS.id,
      redirectUri: "http://localhost:3000/dashboard/ads",
    };

    const req = buildAuthRequest(
      "POST",
      "/api/v1/ads/accounts/connect/meta",
      userToken,
      requestBody,
    );
    const res = await initiateMetaOAuthPost(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.oauthUrl).toContain(
      "https://www.facebook.com/v21.0/dialog/oauth",
    );
    expect(body.data.redirectUri).toBe("http://localhost:3000/dashboard/ads");
  });

  it("should use default redirectUri when not provided", async () => {
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);

    const requestBody = {
      businessId: TEST_BUSINESS.id,
    };

    const req = buildAuthRequest(
      "POST",
      "/api/v1/ads/accounts/connect/meta",
      userToken,
      requestBody,
    );
    const res = await initiateMetaOAuthPost(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.redirectUri).toBe("http://localhost:3000/dashboard/ads");
  });
});

// ── OAuth Callback ──

describe("GET /api/v1/auth/callback/meta-ads", () => {
  it("should handle successful OAuth callback and create ad accounts", async () => {
    // Mock user and business lookup
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);

    // Mock token exchange
    const mockTokenResponse = {
      access_token: "short-lived-token",
      token_type: "bearer",
      expires_in: 3600,
    };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokenResponse),
    });

    // Mock long-lived token exchange
    const mockLongLivedResponse = {
      access_token: "long-lived-token-60-days",
      expires_in: 5184000,
    };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLongLivedResponse),
    });

    // Mock ad accounts fetch
    const mockAdAccountsResponse = {
      data: [
        {
          id: "act_123456789",
          name: "Test Ad Account",
          account_id: "123456789",
          account_status: 1, // ACTIVE
          currency: "USD",
          timezone_name: "America/New_York",
        },
      ],
    };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockAdAccountsResponse),
    });

    // Mock adAccount upsert
    prismaMock.adAccount.upsert.mockResolvedValue({
      id: "ad-account-123",
      userId: TEST_USER.id,
      businessId: TEST_BUSINESS.id,
      platform: "meta_ads",
      platformAccountId: "act_123456789",
      accountName: "Test Ad Account",
      accountCurrency: "USD",
      timezone: "America/New_York",
      encryptedToken: "mock-encrypted-token",
      tokenIv: "mock-iv",
      tokenExpiresAt: new Date(Date.now() + 5184000 * 1000),
      status: "active",
      lastSyncedAt: new Date(),
      metadata: {
        accountId: "123456789",
        accountStatus: 1,
        id: "act_123456789",
        name: "Test Ad Account",
        currency: "USD",
        timezone_name: "America/New_York",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Mock audit log
    prismaMock.auditLog.create.mockResolvedValue({} as any);

    // Create state parameter
    const stateData = {
      userId: TEST_USER.id,
      businessId: TEST_BUSINESS.id,
      timestamp: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64");

    const req = buildRequest(
      "GET",
      `/api/v1/auth/callback/meta-ads?code=auth-code-123&state=${state}`,
    );
    const res = await handleMetaCallback(req);

    // Should redirect to success page
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(
      "/dashboard/ads?success=true",
    );
    expect(res.headers.get("location")).toContain("accounts=1");

    // Verify token exchange was called
    const fetchCall = (global.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toBe(
      "https://graph.facebook.com/v21.0/oauth/access_token",
    );
    expect(fetchCall[1].method).toBe("POST");
    expect(fetchCall[1].body).toContain("client_id=test-client-id");
    expect(fetchCall[1].body).toContain("code=auth-code-123");

    // Verify ad accounts were fetched
    expect(global.fetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name&access_token=long-lived-token-60-days",
      expect.any(Object),
    );

    // Verify ad account was saved
    expect(prismaMock.adAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_businessId_platform_platformAccountId: {
            userId: TEST_USER.id,
            businessId: TEST_BUSINESS.id,
            platform: "meta_ads",
            platformAccountId: "act_123456789",
          },
        },
        update: expect.any(Object),
        create: expect.any(Object),
      }),
    );
  });

  it("should handle OAuth errors", async () => {
    const req = buildRequest(
      "GET",
      "/api/v1/auth/callback/meta-ads?error=access_denied&error_reason=user_denied&error_description=User+denied+the+request",
    );
    const res = await handleMetaCallback(req);

    // Should redirect to error page
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/dashboard/ads?error=");
    expect(res.headers.get("location")).toContain("User+denied+the+request");
  });

  it("should reject when missing code or state", async () => {
    const req = buildRequest("GET", "/api/v1/auth/callback/meta-ads");
    const res = await handleMetaCallback(req);

    // Should redirect to error page
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/dashboard/ads?error=");
  });

  it("should reject invalid state parameter", async () => {
    const req = buildRequest(
      "GET",
      "/api/v1/auth/callback/meta-ads?code=auth-code-123&state=invalid-base64",
    );
    const res = await handleMetaCallback(req);

    // Should redirect to error page
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/dashboard/ads?error=");
  });

  it("should reject expired state", async () => {
    const stateData = {
      userId: TEST_USER.id,
      businessId: TEST_BUSINESS.id,
      timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago (expired)
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64");

    const req = buildRequest(
      "GET",
      `/api/v1/auth/callback/meta-ads?code=auth-code-123&state=${state}`,
    );
    const res = await handleMetaCallback(req);

    // Should redirect to error page
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/dashboard/ads?error=");
  });

  it("should handle token exchange failure gracefully", async () => {
    // Mock user and business lookup
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);

    // Mock token exchange failure
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve("Invalid grant"),
    });

    const stateData = {
      userId: TEST_USER.id,
      businessId: TEST_BUSINESS.id,
      timestamp: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64");

    const req = buildRequest(
      "GET",
      `/api/v1/auth/callback/meta-ads?code=invalid-code&state=${state}`,
    );
    const res = await handleMetaCallback(req);

    // Should redirect to error page
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/dashboard/ads?error=");
  });

  it("should handle ad accounts fetch failure gracefully", async () => {
    // Mock user and business lookup
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);

    // Mock token exchange
    const mockTokenResponse = {
      access_token: "short-lived-token",
      token_type: "bearer",
      expires_in: 3600,
    };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokenResponse),
    });

    // Mock long-lived token exchange
    const mockLongLivedResponse = {
      access_token: "long-lived-token-60-days",
      expires_in: 5184000,
    };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLongLivedResponse),
    });

    // Mock ad accounts fetch failure
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve("Permission error"),
    });

    // Mock audit log
    prismaMock.auditLog.create.mockResolvedValue({} as any);

    const stateData = {
      userId: TEST_USER.id,
      businessId: TEST_BUSINESS.id,
      timestamp: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64");

    const req = buildRequest(
      "GET",
      `/api/v1/auth/callback/meta-ads?code=auth-code-123&state=${state}`,
    );
    const res = await handleMetaCallback(req);

    // Should still redirect (connection succeeded but no accounts)
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(
      "/dashboard/ads?success=true",
    );
    expect(res.headers.get("location")).toContain("accounts=0");
    expect(res.headers.get("location")).toContain("warning=");
  });

  it("should skip inactive ad accounts", async () => {
    // Mock user and business lookup
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.business.findFirst.mockResolvedValue(TEST_BUSINESS);

    // Mock token exchange
    const mockTokenResponse = {
      access_token: "short-lived-token",
      token_type: "bearer",
      expires_in: 3600,
    };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokenResponse),
    });

    // Mock long-lived token exchange
    const mockLongLivedResponse = {
      access_token: "long-lived-token-60-days",
      expires_in: 5184000,
    };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLongLivedResponse),
    });

    // Mock ad accounts with inactive account
    const mockAdAccountsResponse = {
      data: [
        {
          id: "act_123456789",
          name: "Active Ad Account",
          account_id: "123456789",
          account_status: 1, // ACTIVE
          currency: "USD",
          timezone_name: "America/New_York",
        },
        {
          id: "act_987654321",
          name: "Disabled Ad Account",
          account_id: "987654321",
          account_status: 2, // DISABLED
          currency: "USD",
          timezone_name: "America/New_York",
        },
      ],
    };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockAdAccountsResponse),
    });

    // Mock adAccount upsert (only for active account)
    prismaMock.adAccount.upsert.mockResolvedValue({
      id: "ad-account-123",
      userId: TEST_USER.id,
      businessId: TEST_BUSINESS.id,
      platform: "meta_ads",
      platformAccountId: "act_123456789",
      accountName: "Active Ad Account",
      accountCurrency: "USD",
      timezone: "America/New_York",
      encryptedToken: "mock-encrypted-token",
      tokenIv: "mock-iv",
      tokenExpiresAt: new Date(Date.now() + 5184000 * 1000),
      status: "active",
      lastSyncedAt: new Date(),
      metadata: expect.any(Object),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Mock audit log
    prismaMock.auditLog.create.mockResolvedValue({} as any);

    const stateData = {
      userId: TEST_USER.id,
      businessId: TEST_BUSINESS.id,
      timestamp: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64");

    const req = buildRequest(
      "GET",
      `/api/v1/auth/callback/meta-ads?code=auth-code-123&state=${state}`,
    );
    const res = await handleMetaCallback(req);

    // Should only create one ad account (the active one)
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("accounts=1");
    expect(prismaMock.adAccount.upsert).toHaveBeenCalledTimes(1);
  });
});
