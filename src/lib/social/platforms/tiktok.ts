import { PlatformAdapter } from "../platform-adapter";
import type {
  OAuthConfig,
  OAuthTokens,
  PostContent,
  PublishResult,
  PostAnalytics,
  PlatformConstraints,
  PlatformProfile,
  RateLimitConfig,
} from "../types";
import { PLATFORM_CONSTRAINTS, PLATFORM_RATE_LIMITS } from "../types";

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";
const TIKTOK_AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize";

/**
 * TikTok platform adapter using TikTok Content Posting API v2.
 * Supports video publishing (direct post and inbox), photo posts, and analytics.
 * Note: TikTok has strict rate limits — 3 videos/day per user.
 */
export class TikTokAdapter extends PlatformAdapter {
  readonly platform = "tiktok" as const;
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.tiktok;
  readonly rateLimitConfig: RateLimitConfig = PLATFORM_RATE_LIMITS.tiktok;

  getOAuthConfig(): OAuthConfig {
    return {
      platform: "tiktok",
      clientId: process.env.TIKTOK_CLIENT_KEY!,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
      authorizationUrl: TIKTOK_AUTH_BASE,
      tokenUrl: `${TIKTOK_API_BASE}/oauth/token/`,
      scopes: [
        "video.publish",
        "video.upload",
        "user.info.basic",
        "video.list",
      ],
      redirectUri: `${process.env.APP_URL}/api/v1/auth/callback/tiktok`,
    };
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TikTok token exchange failed: ${error}`);
    }

    const data = (await response.json()) as {
      data: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        refresh_expires_in: number;
        open_id: string;
        scope: string;
        token_type: string;
      };
    };

    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: new Date(Date.now() + data.data.expires_in * 1000),
      scopes: data.data.scope.split(","),
      tokenType: data.data.token_type,
      metadata: { openId: data.data.open_id },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens | null> {
    const config = this.getOAuthConfig();

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      data: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        open_id: string;
        scope: string;
        token_type: string;
      };
    };

    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: new Date(Date.now() + data.data.expires_in * 1000),
      scopes: data.data.scope.split(","),
      tokenType: data.data.token_type,
      metadata: { openId: data.data.open_id },
    };
  }

  async validateTokens(accessToken: string): Promise<boolean> {
    const response = await fetch(`${TIKTOK_API_BASE}/user/info/`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.ok;
  }

  async getProfile(accessToken: string): Promise<PlatformProfile> {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count,union_id',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch TikTok profile: ${response.statusText}`);
    }
    const data = (await response.json()) as {
      data: { user: { open_id: string; display_name: string; avatar_url?: string; follower_count?: number; union_id?: string } };
    };
    const u = data.data.user;
    return {
      id: u.union_id || u.open_id,
      name: u.display_name,
      handle: u.display_name,
      avatarUrl: u.avatar_url,
      followerCount: u.follower_count,
    };
  }

  async publish(
    accessToken: string,
    content: PostContent
  ): Promise<PublishResult> {
    try {
      const media = content.media ?? [];
      const videos = media.filter((m) => m.type === "video");
      const images = media.filter((m) => m.type === "image");

      if (videos.length > 0) {
        return await this.publishVideo(accessToken, content, videos[0].url);
      } else if (images.length > 0) {
        return await this.publishPhotoPost(accessToken, content, images);
      }

      return { success: false, error: "TikTok requires at least one video or image" };
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
    const response = await fetch(`${TIKTOK_API_BASE}/video/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filters: { video_ids: [platformPostId] },
        fields: [
          "like_count",
          "comment_count",
          "share_count",
          "view_count",
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch TikTok analytics: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: {
        videos: Array<{
          like_count: number;
          comment_count: number;
          share_count: number;
          view_count: number;
        }>;
      };
    };

    const video = data.data.videos[0];
    if (!video) {
      throw new Error(`TikTok video ${platformPostId} not found`);
    }

    const views = video.view_count ?? 0;
    const likes = video.like_count ?? 0;
    const comments = video.comment_count ?? 0;
    const shares = video.share_count ?? 0;

    return {
      impressions: views,
      reach: views, // TikTok doesn't distinguish reach from views in basic API
      likes,
      comments,
      shares,
      saves: 0, // Not available in basic API
      clicks: 0, // Not available in basic API
      engagementRate: views > 0 ? (likes + comments + shares) / views : 0,
      fetchedAt: new Date(),
    };
  }

  async deletePost(
    accessToken: string,
    platformPostId: string
  ): Promise<boolean> {
    // TikTok Content Posting API doesn't support delete via API
    // Videos can only be deleted through the TikTok app
    console.warn(
      `TikTok does not support video deletion via API. Video ${platformPostId} must be deleted manually.`
    );
    return false;
  }

  // ---- Private helpers ----

  private async publishVideo(
    accessToken: string,
    content: PostContent,
    videoUrl: string
  ): Promise<PublishResult> {
    // Step 1: Initialize upload using pull-from-URL
    const initResponse = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: this.formatCaption(content),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
    });

    if (!initResponse.ok) {
      const error = await initResponse.text();
      return { success: false, error: `TikTok video init failed: ${error}` };
    }

    const initData = (await initResponse.json()) as {
      data: { publish_id: string };
    };

    // Step 2: Poll for publish status
    const publishId = initData.data.publish_id;
    const postId = await this.waitForPublish(accessToken, publishId);

    return {
      success: true,
      platformPostId: postId ?? publishId,
      platformPostUrl: postId ? `https://www.tiktok.com/@user/video/${postId}` : undefined,
      rawResponse: initData,
    };
  }

  private async publishPhotoPost(
    accessToken: string,
    content: PostContent,
    images: NonNullable<PostContent["media"]>
  ): Promise<PublishResult> {
    // TikTok photo mode: upload images as a photo post
    const initResponse = await fetch(`${TIKTOK_API_BASE}/post/publish/content/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: this.formatCaption(content),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_comment: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: images.map((img) => img.url),
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      }),
    });

    if (!initResponse.ok) {
      const error = await initResponse.text();
      return { success: false, error: `TikTok photo post failed: ${error}` };
    }

    const initData = (await initResponse.json()) as {
      data: { publish_id: string };
    };

    const publishId = initData.data.publish_id;
    const postId = await this.waitForPublish(accessToken, publishId);

    return {
      success: true,
      platformPostId: postId ?? publishId,
      rawResponse: initData,
    };
  }

  private async waitForPublish(
    accessToken: string,
    publishId: string,
    maxAttempts = 30
  ): Promise<string | null> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusResponse = await fetch(
        `${TIKTOK_API_BASE}/post/publish/status/fetch/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ publish_id: publishId }),
        }
      );

      if (!statusResponse.ok) continue;

      const statusData = (await statusResponse.json()) as {
        data: {
          status: string;
          publicaly_available_post_id?: Array<{ id: string }>;
        };
      };

      if (statusData.data.status === "PUBLISH_COMPLETE") {
        return statusData.data.publicaly_available_post_id?.[0]?.id ?? null;
      }

      if (statusData.data.status === "FAILED") {
        throw new Error("TikTok publish failed during processing");
      }
    }

    throw new Error("TikTok publish timed out");
  }

  private formatCaption(content: PostContent): string {
    let text = content.text;

    if (content.hashtags && content.hashtags.length > 0) {
      const hashtagStr = content.hashtags
        .map((h) => (h.startsWith("#") ? h : `#${h}`))
        .join(" ");
      const combined = `${text} ${hashtagStr}`;
      if (combined.length <= 2200) {
        text = combined;
      }
    }

    return text;
  }
}
