import type {
  Platform,
  OAuthConfig,
  OAuthTokens,
  PostContent,
  PublishResult,
  PostAnalytics,
  PlatformConstraints,
  RateLimitConfig,
  PlatformProfile,
} from "./types";

/**
 * Abstract base class for all social media platform adapters.
 * Each platform implements this interface to handle its specific API.
 */
export abstract class PlatformAdapter {
  abstract readonly platform: Platform;
  abstract readonly constraints: PlatformConstraints;
  abstract readonly rateLimitConfig: RateLimitConfig;

  /**
   * Returns the OAuth2 configuration for this platform.
   */
  abstract getOAuthConfig(): OAuthConfig;

  /**
   * Exchanges an authorization code for tokens.
   */
  abstract exchangeCodeForTokens(
    code: string,
    codeVerifier?: string
  ): Promise<OAuthTokens>;

  /**
   * Refreshes an expired access token.
   * Returns null if refresh is not supported or token is permanently invalid.
   */
  abstract refreshAccessToken(
    refreshToken: string
  ): Promise<OAuthTokens | null>;

  /**
   * Validates that the current tokens are still working.
   */
  abstract validateTokens(accessToken: string): Promise<boolean>;

  /**
   * Fetches the authenticated user's profile from the platform.
   */
  abstract getProfile(accessToken: string): Promise<PlatformProfile>;

  /**
   * Publishes content to the platform.
   */
  abstract publish(
    accessToken: string,
    content: PostContent
  ): Promise<PublishResult>;

  /**
   * Fetches analytics for a published post.
   */
  abstract fetchAnalytics(
    accessToken: string,
    platformPostId: string
  ): Promise<PostAnalytics>;

  /**
   * Deletes a published post from the platform.
   */
  abstract deletePost(
    accessToken: string,
    platformPostId: string
  ): Promise<boolean>;

  /**
   * Validates content against platform constraints before publishing.
   * Returns an array of validation error messages (empty = valid).
   */
  validateContent(content: PostContent): string[] {
    const errors: string[] = [];
    const c = this.constraints;

    if (content.text.length > c.maxTextLength) {
      errors.push(
        `Text exceeds ${c.maxTextLength} character limit (got ${content.text.length})`
      );
    }

    if (content.hashtags && content.hashtags.length > c.maxHashtags) {
      errors.push(
        `Too many hashtags: max ${c.maxHashtags} (got ${content.hashtags.length})`
      );
    }

    if (content.media) {
      const images = content.media.filter((m) => m.type === "image");
      if (images.length > c.maxImages) {
        errors.push(
          `Too many images: max ${c.maxImages} (got ${images.length})`
        );
      }

      for (const media of content.media) {
        if (media.sizeBytes) {
          const maxSize =
            media.type === "video" ? c.maxVideoSizeBytes : c.maxImageSizeBytes;
          if (media.sizeBytes > maxSize) {
            errors.push(
              `${media.type} exceeds max size of ${maxSize} bytes (got ${media.sizeBytes})`
            );
          }
        }

        if (media.mimeType) {
          const supported =
            media.type === "video"
              ? c.supportedVideoFormats
              : c.supportedImageFormats;
          if (!supported.includes(media.mimeType)) {
            errors.push(
              `Unsupported ${media.type} format: ${media.mimeType}. Supported: ${supported.join(", ")}`
            );
          }
        }
      }
    }

    return errors;
  }
}
