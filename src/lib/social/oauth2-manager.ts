import { randomBytes, createHash } from "crypto";
import type { Platform, OAuthTokens, EncryptedTokens } from "./types";
import { encryptToken, decryptToken } from "./token-encryption";
import { PlatformAdapter } from "./platform-adapter";
import { getPlatformAdapter } from "./platforms";

/**
 * Unified OAuth2 manager that handles authorization flows, token storage,
 * and automatic token refresh across all social media platforms.
 */
export class OAuth2Manager {
  /**
   * Generates the authorization URL for a given platform.
   * Returns the URL and optional PKCE code verifier (for platforms that require it).
   */
  getAuthorizationUrl(
    platform: Platform,
    state: string
  ): { url: string; codeVerifier?: string } {
    const adapter = getPlatformAdapter(platform);
    const config = adapter.getOAuthConfig();

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: config.scopes.join(" "),
      state,
    });

    let codeVerifier: string | undefined;

    if (config.usePKCE) {
      codeVerifier = randomBytes(32).toString("base64url");
      const codeChallenge = createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");
      params.set("code_challenge", codeChallenge);
      params.set("code_challenge_method", "S256");
    }

    return {
      url: `${config.authorizationUrl}?${params.toString()}`,
      codeVerifier,
    };
  }

  /**
   * Exchanges an authorization code for encrypted tokens.
   */
  async exchangeCode(
    platform: Platform,
    code: string,
    codeVerifier?: string
  ): Promise<{ tokens: OAuthTokens; encrypted: EncryptedTokens }> {
    const adapter = getPlatformAdapter(platform);
    const tokens = await adapter.exchangeCodeForTokens(code, codeVerifier);

    const encrypted: EncryptedTokens = {
      accessTokenEncrypted: encryptToken(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken
        ? encryptToken(tokens.refreshToken)
        : null,
      expiresAt: tokens.expiresAt,
    };

    return { tokens, encrypted };
  }

  /**
   * Refreshes tokens for a platform. Decrypts the stored refresh token,
   * calls the platform API, and returns new encrypted tokens.
   */
  async refreshTokens(
    platform: Platform,
    encryptedRefreshToken: string
  ): Promise<{ tokens: OAuthTokens; encrypted: EncryptedTokens } | null> {
    const adapter = getPlatformAdapter(platform);
    const refreshToken = decryptToken(encryptedRefreshToken);
    const tokens = await adapter.refreshAccessToken(refreshToken);

    if (!tokens) return null;

    const encrypted: EncryptedTokens = {
      accessTokenEncrypted: encryptToken(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken
        ? encryptToken(tokens.refreshToken)
        : null,
      expiresAt: tokens.expiresAt,
    };

    return { tokens, encrypted };
  }

  /**
   * Checks if stored tokens are still valid. Decrypts and validates.
   */
  async checkTokenHealth(
    platform: Platform,
    encryptedAccessToken: string
  ): Promise<boolean> {
    const adapter = getPlatformAdapter(platform);
    const accessToken = decryptToken(encryptedAccessToken);
    return adapter.validateTokens(accessToken);
  }

  /**
   * Determines if tokens need refreshing based on expiry.
   * Refreshes proactively 5 minutes before actual expiry.
   */
  needsRefresh(expiresAt: Date | null): boolean {
    if (!expiresAt) return false;
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    return new Date().getTime() >= expiresAt.getTime() - bufferMs;
  }

  /**
   * Decrypts the access token for use in API calls.
   */
  decryptAccessToken(encryptedAccessToken: string): string {
    return decryptToken(encryptedAccessToken);
  }
}

export const oauth2Manager = new OAuth2Manager();
