import { encryptToken, decryptToken } from "../social/token-encryption";
import { AdPlatformAdapter } from "./ad-platform-adapter";
import { MetaAdsAdapter } from "./platforms/meta-ads-adapter";
import { GoogleAdsAdapter } from "./platforms/google-ads-adapter";
import { TikTokAdsAdapter } from "./platforms/tiktok-ads-adapter";
import type { AdPlatform, AdOAuthTokens, AdAccountInfo } from "./types";

interface StoredAdCredentials {
  platform: AdPlatform;
  platformAccountId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  expiresAt: Date | null;
}

/**
 * Manages ad account OAuth connections and credential lifecycle.
 * Handles token storage, refresh, and adapter instantiation.
 */
export class AdAccountManager {
  /**
   * Returns the correct adapter for a given ad platform + account ID.
   */
  static getAdapter(
    platform: AdPlatform,
    platformAccountId: string
  ): AdPlatformAdapter {
    switch (platform) {
      case "meta":
        return new MetaAdsAdapter(platformAccountId);
      case "google":
        return new GoogleAdsAdapter(platformAccountId);
      case "tiktok":
        return new TikTokAdsAdapter(platformAccountId);
      default:
        throw new Error(`Unsupported ad platform: ${platform}`);
    }
  }

  /**
   * Generates the OAuth authorization URL for connecting an ad account.
   */
  static getAuthorizationUrl(
    platform: AdPlatform,
    platformAccountId: string,
    state: string
  ): string {
    const adapter = AdAccountManager.getAdapter(platform, platformAccountId);
    const config = adapter.getAdOAuthConfig();

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(" "),
      response_type: "code",
      state,
    });

    return `${config.authorizationUrl}?${params}`;
  }

  /**
   * Exchanges an authorization code for tokens and encrypts them for storage.
   */
  static async exchangeAndEncrypt(
    platform: AdPlatform,
    platformAccountId: string,
    code: string
  ): Promise<StoredAdCredentials> {
    const adapter = AdAccountManager.getAdapter(platform, platformAccountId);
    const tokens = await adapter.exchangeAdCodeForTokens(code);

    return {
      platform,
      platformAccountId,
      accessTokenEncrypted: encryptToken(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken
        ? encryptToken(tokens.refreshToken)
        : null,
      expiresAt: tokens.expiresAt,
    };
  }

  /**
   * Decrypts stored credentials and returns a usable access token.
   * Automatically refreshes if expired.
   */
  static async getAccessToken(
    credentials: StoredAdCredentials
  ): Promise<{
    accessToken: string;
    refreshed: boolean;
    updatedCredentials?: StoredAdCredentials;
  }> {
    const accessToken = decryptToken(credentials.accessTokenEncrypted);

    // Check if token is expired or about to expire (5 min buffer)
    if (
      credentials.expiresAt &&
      credentials.expiresAt.getTime() < Date.now() + 5 * 60 * 1000
    ) {
      if (!credentials.refreshTokenEncrypted) {
        throw new Error(
          `Ad account ${credentials.platformAccountId} token expired and no refresh token available`
        );
      }

      const refreshToken = decryptToken(credentials.refreshTokenEncrypted);
      const adapter = AdAccountManager.getAdapter(
        credentials.platform,
        credentials.platformAccountId
      );

      const newTokens = await adapter.refreshAdAccessToken(refreshToken);
      if (!newTokens) {
        throw new Error(
          `Failed to refresh token for ad account ${credentials.platformAccountId}`
        );
      }

      return {
        accessToken: newTokens.accessToken,
        refreshed: true,
        updatedCredentials: {
          ...credentials,
          accessTokenEncrypted: encryptToken(newTokens.accessToken),
          refreshTokenEncrypted: newTokens.refreshToken
            ? encryptToken(newTokens.refreshToken)
            : credentials.refreshTokenEncrypted,
          expiresAt: newTokens.expiresAt,
        },
      };
    }

    return { accessToken, refreshed: false };
  }

  /**
   * Fetches ad account info using stored credentials.
   */
  static async getAccountInfo(
    credentials: StoredAdCredentials
  ): Promise<AdAccountInfo> {
    const { accessToken } = await AdAccountManager.getAccessToken(credentials);
    const adapter = AdAccountManager.getAdapter(
      credentials.platform,
      credentials.platformAccountId
    );
    return adapter.getAdAccountInfo(accessToken);
  }
}
