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

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3";
const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * YouTube platform adapter using YouTube Data API v3.
 * Supports video uploads with resumable upload protocol and Shorts detection.
 * Uses Google OAuth2 for authentication.
 */
export class YouTubeAdapter extends PlatformAdapter {
  readonly platform = "youtube" as const;
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.youtube;
  readonly rateLimitConfig: RateLimitConfig = PLATFORM_RATE_LIMITS.youtube;

  getOAuthConfig(): OAuthConfig {
    return {
      platform: "youtube",
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorizationUrl: GOOGLE_AUTH_BASE,
      tokenUrl: GOOGLE_TOKEN_URL,
      scopes: [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.force-ssl",
      ],
      redirectUri: `${process.env.APP_URL}/api/v1/auth/callback/youtube`,
    };
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`YouTube token exchange failed: ${error}`);
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
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken, // Google reuses the same refresh token
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope.split(" "),
      tokenType: data.token_type,
    };
  }

  async validateTokens(accessToken: string): Promise<boolean> {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=id&mine=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.ok;
  }

  async getProfile(accessToken: string): Promise<PlatformProfile> {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&mine=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch YouTube profile: ${response.statusText}`);
    }
    const data = (await response.json()) as {
      items: Array<{
        id: string;
        snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } };
        statistics?: { subscriberCount?: string };
      }>;
    };
    const channel = data.items[0];
    if (!channel) throw new Error('No YouTube channel found');
    return {
      id: channel.id,
      name: channel.snippet.title,
      handle: channel.snippet.customUrl || channel.snippet.title,
      avatarUrl: channel.snippet.thumbnails?.default?.url,
      followerCount: channel.statistics?.subscriberCount
        ? parseInt(channel.statistics.subscriberCount, 10)
        : undefined,
    };
  }

  async publish(
    accessToken: string,
    content: PostContent
  ): Promise<PublishResult> {
    try {
      const media = content.media ?? [];
      const videos = media.filter((m) => m.type === "video");

      if (videos.length === 0) {
        return { success: false, error: "YouTube requires a video to publish" };
      }

      const videoUrl = videos[0].url;
      const caption = this.formatDescription(content);
      const title = content.text.slice(0, 100) || "Untitled";

      // Determine tags from hashtags
      const tags = content.hashtags?.map((h) =>
        h.startsWith("#") ? h.slice(1) : h
      ) ?? [];

      // Step 1: Initiate resumable upload
      const uploadUrl = await this.initiateResumableUpload(accessToken, {
        title,
        description: caption,
        tags,
        privacyStatus: "public",
      });

      // Step 2: Download and upload the video
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        return { success: false, error: `Failed to download video: ${videoUrl}` };
      }
      const videoBuffer = await videoResponse.arrayBuffer();
      const videoContentType = videoResponse.headers.get("content-type") ?? "video/mp4";

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": videoContentType,
          "Content-Length": String(videoBuffer.byteLength),
        },
        body: videoBuffer,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        return { success: false, error: `YouTube upload failed: ${error}` };
      }

      const uploadResult = (await uploadResponse.json()) as {
        id: string;
        snippet: { title: string };
      };

      // Step 3: Set thumbnail if an image is provided
      const thumbnails = media.filter((m) => m.type === "image");
      if (thumbnails.length > 0) {
        await this.setThumbnail(accessToken, uploadResult.id, thumbnails[0].url);
      }

      return {
        success: true,
        platformPostId: uploadResult.id,
        platformPostUrl: `https://www.youtube.com/watch?v=${uploadResult.id}`,
        rawResponse: uploadResult,
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
    const response = await fetch(
      `${YOUTUBE_API_BASE}/videos?part=statistics&id=${platformPostId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch YouTube analytics: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      items: Array<{
        statistics: {
          viewCount: string;
          likeCount: string;
          commentCount: string;
          favoriteCount: string;
        };
      }>;
    };

    if (data.items.length === 0) {
      throw new Error(`YouTube video ${platformPostId} not found`);
    }

    const stats = data.items[0].statistics;
    const views = parseInt(stats.viewCount, 10) || 0;
    const likes = parseInt(stats.likeCount, 10) || 0;
    const comments = parseInt(stats.commentCount, 10) || 0;
    const favorites = parseInt(stats.favoriteCount, 10) || 0;

    return {
      impressions: views,
      reach: views, // YouTube doesn't distinguish reach from views in basic API
      likes,
      comments,
      shares: 0, // Not available in YouTube Data API v3 basic stats
      saves: favorites,
      clicks: 0, // Not available in YouTube Data API v3 basic stats
      engagementRate: views > 0 ? (likes + comments + favorites) / views : 0,
      fetchedAt: new Date(),
    };
  }

  async deletePost(
    accessToken: string,
    platformPostId: string
  ): Promise<boolean> {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/videos?id=${platformPostId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.ok || response.status === 204;
  }

  // ---- Private helpers ----

  private async initiateResumableUpload(
    accessToken: string,
    metadata: {
      title: string;
      description: string;
      tags: string[];
      privacyStatus: string;
    }
  ): Promise<string> {
    const response = await fetch(
      `${YOUTUBE_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/*",
        },
        body: JSON.stringify({
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags,
            categoryId: "22", // People & Blogs (default)
          },
          status: {
            privacyStatus: metadata.privacyStatus,
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`YouTube resumable upload init failed: ${error}`);
    }

    const uploadUrl = response.headers.get("Location");
    if (!uploadUrl) {
      throw new Error("YouTube did not return a resumable upload URL");
    }

    return uploadUrl;
  }

  private async setThumbnail(
    accessToken: string,
    videoId: string,
    thumbnailUrl: string
  ): Promise<void> {
    const imageResponse = await fetch(thumbnailUrl);
    if (!imageResponse.ok) return;

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";

    await fetch(
      `${YOUTUBE_UPLOAD_BASE}/thumbnails/set?videoId=${videoId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": contentType,
        },
        body: imageBuffer,
      }
    );
  }

  private formatDescription(content: PostContent): string {
    let text = content.text;

    if (content.hashtags && content.hashtags.length > 0) {
      const hashtagStr = content.hashtags
        .map((h) => (h.startsWith("#") ? h : `#${h}`))
        .join(" ");
      text = `${text}\n\n${hashtagStr}`;
    }

    if (content.link) {
      text = `${text}\n\n${content.link}`;
    }

    return text.slice(0, 5000);
  }
}
