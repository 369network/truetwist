import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuth2Manager } from '../oauth2-manager';
import { getPlatformAdapter } from '../platforms';
import { encryptToken, decryptToken } from '../token-encryption';

// ---------- mocks ----------

vi.mock('../platforms', () => ({
  getPlatformAdapter: vi.fn().mockReturnValue({
    getOAuthConfig: vi.fn().mockReturnValue({
      clientId: 'client-123',
      redirectUri: 'http://localhost/callback',
      authorizationUrl: 'https://auth.example.com/authorize',
      scopes: ['read', 'write'],
      usePKCE: false,
    }),
    exchangeCodeForTokens: vi.fn().mockResolvedValue({
      accessToken: 'access-tok',
      refreshToken: 'refresh-tok',
      expiresAt: new Date('2030-01-01'),
      scopes: ['read', 'write'],
      tokenType: 'Bearer',
    }),
    refreshAccessToken: vi.fn().mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresAt: new Date('2030-01-01'),
      scopes: ['read', 'write'],
      tokenType: 'Bearer',
    }),
    validateTokens: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('../token-encryption', () => ({
  encryptToken: vi.fn().mockImplementation((s: string) => `encrypted:${s}`),
  decryptToken: vi.fn().mockImplementation((s: string) => s.replace('encrypted:', '')),
}));

// ---------- helpers ----------

const mockGetPlatformAdapter = vi.mocked(getPlatformAdapter);
const mockEncryptToken = vi.mocked(encryptToken);
const mockDecryptToken = vi.mocked(decryptToken);

/** Returns the single mock adapter object that getPlatformAdapter always returns. */
function mockAdapter() {
  return mockGetPlatformAdapter.mock.results[mockGetPlatformAdapter.mock.results.length - 1]?.value
    ?? mockGetPlatformAdapter('twitter' as any);
}

// ---------- tests ----------

describe('OAuth2Manager', () => {
  let manager: OAuth2Manager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire the mock after clearAllMocks so subsequent calls still return the mock adapter
    mockGetPlatformAdapter.mockReturnValue({
      getOAuthConfig: vi.fn().mockReturnValue({
        clientId: 'client-123',
        redirectUri: 'http://localhost/callback',
        authorizationUrl: 'https://auth.example.com/authorize',
        scopes: ['read', 'write'],
        usePKCE: false,
      }),
      exchangeCodeForTokens: vi.fn().mockResolvedValue({
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
        expiresAt: new Date('2030-01-01'),
        scopes: ['read', 'write'],
        tokenType: 'Bearer',
      }),
      refreshAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresAt: new Date('2030-01-01'),
        scopes: ['read', 'write'],
        tokenType: 'Bearer',
      }),
      validateTokens: vi.fn().mockResolvedValue(true),
    } as any);

    mockEncryptToken.mockImplementation((s: string) => `encrypted:${s}`);
    mockDecryptToken.mockImplementation((s: string) => s.replace('encrypted:', ''));

    manager = new OAuth2Manager();
  });

  // ---- getAuthorizationUrl ----

  describe('getAuthorizationUrl', () => {
    it('returns a URL whose origin and path come from the adapter config', () => {
      const { url } = manager.getAuthorizationUrl('twitter', 'state-abc');
      expect(url).toContain('https://auth.example.com/authorize');
    });

    it('URL includes state, scope, and client_id query params', () => {
      const { url } = manager.getAuthorizationUrl('twitter', 'my-state');
      const parsed = new URL(url);
      expect(parsed.searchParams.get('state')).toBe('my-state');
      expect(parsed.searchParams.get('scope')).toBe('read write');
      expect(parsed.searchParams.get('client_id')).toBe('client-123');
    });

    it('does not include PKCE params and returns no codeVerifier when usePKCE is false', () => {
      const { url, codeVerifier } = manager.getAuthorizationUrl('twitter', 'state-xyz');
      expect(codeVerifier).toBeUndefined();
      expect(url).not.toContain('code_challenge');
    });

    it('returns a codeVerifier and adds code_challenge / code_challenge_method to URL when usePKCE is true', () => {
      mockGetPlatformAdapter.mockReturnValueOnce({
        getOAuthConfig: vi.fn().mockReturnValue({
          clientId: 'client-123',
          redirectUri: 'http://localhost/callback',
          authorizationUrl: 'https://auth.example.com/authorize',
          scopes: ['read', 'write'],
          usePKCE: true,
        }),
      } as any);

      const { url, codeVerifier } = manager.getAuthorizationUrl('twitter', 'pkce-state');

      expect(typeof codeVerifier).toBe('string');
      expect(codeVerifier!.length).toBeGreaterThan(0);

      const parsed = new URL(url);
      expect(parsed.searchParams.get('code_challenge')).not.toBeNull();
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    });
  });

  // ---- exchangeCode ----

  describe('exchangeCode', () => {
    it('calls adapter.exchangeCodeForTokens with the provided code and optional verifier', async () => {
      await manager.exchangeCode('twitter', 'auth-code-123');
      const adapter = mockAdapter();
      expect(adapter.exchangeCodeForTokens).toHaveBeenCalledWith('auth-code-123', undefined);
    });

    it('returns encrypted access and refresh tokens', async () => {
      const result = await manager.exchangeCode('twitter', 'auth-code');
      expect(result.encrypted.accessTokenEncrypted).toBe('encrypted:access-tok');
      expect(result.encrypted.refreshTokenEncrypted).toBe('encrypted:refresh-tok');
    });

    it('also returns the raw (unencrypted) token data from the adapter', async () => {
      const result = await manager.exchangeCode('twitter', 'auth-code');
      expect(result.tokens.accessToken).toBe('access-tok');
      expect(result.tokens.refreshToken).toBe('refresh-tok');
    });
  });

  // ---- refreshTokens ----

  describe('refreshTokens', () => {
    it('decrypts the stored refresh token before calling the adapter', async () => {
      await manager.refreshTokens('twitter', 'encrypted:old-refresh');
      expect(mockDecryptToken).toHaveBeenCalledWith('encrypted:old-refresh');
    });

    it('returns newly encrypted tokens after a successful refresh', async () => {
      const result = await manager.refreshTokens('twitter', 'encrypted:old-refresh');
      expect(result).not.toBeNull();
      expect(result!.encrypted.accessTokenEncrypted).toBe('encrypted:new-access');
      expect(result!.encrypted.refreshTokenEncrypted).toBe('encrypted:new-refresh');
    });

    it('returns null when the adapter returns null', async () => {
      const adapter = mockAdapter();
      adapter.refreshAccessToken.mockResolvedValueOnce(null);
      const result = await manager.refreshTokens('twitter', 'encrypted:old-refresh');
      expect(result).toBeNull();
    });
  });

  // ---- needsRefresh ----

  describe('needsRefresh', () => {
    it('returns false when expiresAt is null', () => {
      expect(manager.needsRefresh(null)).toBe(false);
    });

    it('returns false for a date far in the future (more than 5 minutes away)', () => {
      const future = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      expect(manager.needsRefresh(future)).toBe(false);
    });

    it('returns true when expiry is within the 5-minute buffer window', () => {
      const soon = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now
      expect(manager.needsRefresh(soon)).toBe(true);
    });

    it('returns true when the token is already past its expiry', () => {
      const past = new Date(Date.now() - 1000); // 1 second ago
      expect(manager.needsRefresh(past)).toBe(true);
    });
  });

  // ---- checkTokenHealth ----

  describe('checkTokenHealth', () => {
    it('decrypts the access token and delegates validation to the platform adapter', async () => {
      const result = await manager.checkTokenHealth('twitter', 'encrypted:access-tok');
      expect(mockDecryptToken).toHaveBeenCalledWith('encrypted:access-tok');
      expect(result).toBe(true);
    });
  });

  // ---- decryptAccessToken ----

  describe('decryptAccessToken', () => {
    it('calls decryptToken and returns the plain access token string', () => {
      const plain = manager.decryptAccessToken('encrypted:my-token');
      expect(mockDecryptToken).toHaveBeenCalledWith('encrypted:my-token');
      expect(plain).toBe('my-token');
    });
  });
});
