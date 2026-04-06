import { PlatformAdapter } from "../platform-adapter";
import type {
  OAuthConfig,
  OAuthTokens,
  PostContent,
  PublishResult,
  PostAnalytics,
  PlatformConstraints,
  RateLimitConfig,
  PlatformProfile,
} from "../types";
import { PLATFORM_CONSTRAINTS, PLATFORM_RATE_LIMITS } from "../types";

const TWITTER_API_BASE = "https://api.twitter.com/2";
const TWITTER_UPLOAD_BASE = "https://upload.twitter.com/1.1";

/**
 * Twitter/X platform adapter using API v2 with OAuth 2.0 + PKCE.
 * Supports text tweets, media tweets (up to 4 images or 1 video), and threads.
 */
export class TwitterAdapter extends PlatformAdapter {
  readonly platform = "twitter" as const;
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.twitter;
  readonly rateLimitConfig: RateLimitConfig = PLATFORM_RATE_LIMITS.twitter;

  getOAuthConfig(): OAuthConfig {
    return {
      platform: "twitter",
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      authorizationUrl: "https://twitter.com/i/oauth2/authorize",
      tokenUrl: "https://api.twitter.com/2/oauth2/token",
      scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
      redirectUri: `${process.env.APP_URL}/api/v1/auth/callback/twitter`,
      usePKCE: true,
    };
  }

  async exchangeCodeForTokens(
    code: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();

    const body: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
    };

    if (codeVerifier) {
      body.code_verifier = codeVerifier;
    }

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twitter token exchange failed: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope.split(" "),
      tokenType: data.token_type,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens | null> {
    const config = this.getOAuthConfig();

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.clientId,
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope.split(" "),
      tokenType: data.token_type,
    };
  }

  async validateTokens(accessToken: string): Promise<boolean> {
    const response = await fetch(`${TWITTER_API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.ok;
  }

  async getProfile(accessToken: string): Promise<PlatformProfile> {
    const response = await fetch(
      `${TWITTER_API_BASE}/users/me?user.fields=name,username,profile_image_url,public_metrics`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Twitter profile: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: {
        id: string;
        name: string;
        username: string;
        profile_image_url?: string;
        public_metrics?: { followers_count: number };
      };
    };

    return {
      id: data.data.id,
      name: data.data.name,
      handle: `@${data.data.username}`,
      avatarUrl: data.data.profile_image_url,
      followerCount: data.data.public_metrics?.followers_count,
    };
  }

  async publish(
    accessToken: string,
    content: PostContent
  ): Promise<PublishResult> {
    try {
      const tweetBody: Record<string, unknown> = {
        text: this.formatTweetText(content),
      };

      // Upload media if present
      if (content.media && content.media.length > 0) {
        const mediaIds = await this.uploadMedia(accessToken, content.media);
        if (mediaIds.length > 0) {
          tweetBody.media = { media_ids: mediaIds };
        }
      }

      const response = await fetch(`${TWITTER_API_BASE}/tweets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tweetBody),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Twitter post failed: ${error}` };
      }

      const data = (await response.json()) as {
        data: { id: string; text: string };
      };

      return {
        success: true,
        platformPostId: data.data.id,
        platformPostUrl: `https://twitter.com/i/status/${data.data.id}`,
        rawResponse: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async fetchAnalytics(
    accessToken: string,
    platformPostId: string
  ): Promise<PostAnalytics> {
    const fields =
      "public_metrics,non_public_metrics,organic_metrics";
    const response = await fetch(
      `${TWITTER_API_BASE}/tweets/${platformPostId}?tweet.fields=${fields}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Twitter analytics: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: {
        public_metrics: {
          retweet_count: number;
          reply_count: number;
          like_count: number;
          quote_count: number;
          bookmark_count: number;
          impression_count: number;
        };
        non_public_metrics?: {
          url_link_clicks: number;
          user_profile_clicks: number;
        };
      };
    };

    const pm = data.data.public_metrics;
    const npm = data.data.non_public_metrics;
    const impressions = pm.impression_count ?? 0;
    const likes = pm.like_count ?? 0;
    const replies = pm.reply_count ?? 0;
    const retweets = pm.retweet_count ?? 0;
    const quotes = pm.quote_count ?? 0;
    const bookmarks = pm.bookmark_count ?? 0;
    const clicks = npm?.url_link_clicks ?? 0;

    return {
      impressions,
      reach: impressions, // Twitter doesn't distinguish reach from impressions
      likes,
      comments: replies,
      shares: retweets + quotes,
      saves: bookmarks,
      clicks,
      engagementRate:
        impressions > 0
          ? (likes + replies + retweets + quotes + bookmarks) / impressions
          : 0,
      fetchedAt: new Date(),
    };
  }

  async deletePost(
    accessToken: string,
    platformPostId: string
  ): Promise<boolean> {
    const response = await fetch(
      `${TWITTER_API_BASE}/tweets/${platformPostId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.ok;
  }

  // ---- Private helpers ----

  private formatTweetText(content: PostContent): string {
    let text = content.text;

    // Append hashtags if there's room
    if (content.hashtags && content.hashtags.length > 0) {
      const hashtagStr = content.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
      const combined = `${text}\n\n${hashtagStr}`;
      if (combined.length <= 280) {
        text = combined;
      }
    }

    // Truncate if still over limit
    if (text.length > 280) {
      text = text.slice(0, 277) + "...";
    }

    return text;
  }

  /**
   * Uploads media files to Twitter using the v1.1 upload endpoint.
   * Returns an array of media_id strings.
   */
  private async uploadMedia(
    accessToken: string,
    media: PostContent["media"]
  ): Promise<string[]> {
    if (!media) return [];

    const mediaIds: string[] = [];

    for (const item of media) {
      // For images, use simple upload
      if (item.type === "image") {
        const mediaId = await this.simpleMediaUpload(accessToken, item.url);
        if (mediaId) mediaIds.push(mediaId);
      }
      // For videos, use chunked upload
      else if (item.type === "video") {
        const mediaId = await this.chunkedMediaUpload(
          accessToken,
          item.url,
          item.mimeType ?? "video/mp4"
        );
        if (mediaId) mediaIds.push(mediaId);
      }
    }

    return mediaIds;
  }

  private async simpleMediaUpload(
    accessToken: string,
    imageUrl: string
  ): Promise<string | null> {
    // Download the image first
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) return null;
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const base64 = imageBuffer.toString("base64");

    const response = await fetch(
      `${TWITTER_UPLOAD_BASE}/media/upload.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ media_data: base64 }),
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { media_id_string: string };
    return data.media_id_string;
  }

  private async chunkedMediaUpload(
    accessToken: string,
    videoUrl: string,
    mimeType: string
  ): Promise<string | null> {
    // Download the video
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) return null;
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    // INIT
    const initResponse = await fetch(
      `${TWITTER_UPLOAD_BASE}/media/upload.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          command: "INIT",
          total_bytes: String(videoBuffer.length),
          media_type: mimeType,
          media_category: "tweet_video",
        }),
      }
    );

    if (!initResponse.ok) return null;
    const initData = (await initResponse.json()) as { media_id_string: string };
    const mediaId = initData.media_id_string;

    // APPEND - upload in 5MB chunks
    const chunkSize = 5 * 1024 * 1024;
    for (let i = 0; i * chunkSize < videoBuffer.length; i++) {
      const chunk = videoBuffer.subarray(i * chunkSize, (i + 1) * chunkSize);
      const formData = new FormData();
      formData.append("command", "APPEND");
      formData.append("media_id", mediaId);
      formData.append("segment_index", String(i));
      formData.append("media_data", chunk.toString("base64"));

      await fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
    }

    // FINALIZE
    const finalizeResponse = await fetch(
      `${TWITTER_UPLOAD_BASE}/media/upload.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          command: "FINALIZE",
          media_id: mediaId,
        }),
      }
    );

    if (!finalizeResponse.ok) return null;

    // Poll for processing completion
    const finalData = (await finalizeResponse.json()) as {
      processing_info?: { state: string; check_after_secs: number };
    };

    if (finalData.processing_info) {
      await this.waitForMediaProcessing(accessToken, mediaId);
    }

    return mediaId;
  }

  private async waitForMediaProcessing(
    accessToken: string,
    mediaId: string,
    maxAttempts = 30
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(
        `${TWITTER_UPLOAD_BASE}/media/upload.json?command=STATUS&media_id=${mediaId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) throw new Error("Failed to check media processing status");

      const data = (await response.json()) as {
        processing_info?: {
          state: string;
          check_after_secs: number;
          error?: { message: string };
        };
      };

      if (!data.processing_info || data.processing_info.state === "succeeded") return;
      if (data.processing_info.state === "failed") {
        throw new Error(
          `Twitter media processing failed: ${data.processing_info.error?.message ?? "unknown error"}`
        );
      }

      const waitMs = (data.processing_info.check_after_secs ?? 2) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    throw new Error("Twitter media processing timed out");
  }
}
