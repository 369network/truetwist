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

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.threads.net/${GRAPH_API_VERSION}`;

/**
 * Threads platform adapter using Meta's Threads API (Graph API based).
 * Supports text posts, image posts, video posts, and carousel posts.
 * Uses Meta OAuth for authentication.
 */
export class ThreadsAdapter extends PlatformAdapter {
  readonly platform = "threads" as const;
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.threads;
  readonly rateLimitConfig: RateLimitConfig = PLATFORM_RATE_LIMITS.threads;

  getOAuthConfig(): OAuthConfig {
    return {
      platform: "threads",
      clientId: process.env.THREADS_APP_ID!,
      clientSecret: process.env.THREADS_APP_SECRET!,
      authorizationUrl: "https://threads.net/oauth/authorize",
      tokenUrl: `${GRAPH_API_BASE}/oauth/access_token`,
      scopes: [
        "threads_basic",
        "threads_content_publish",
        "threads_manage_insights",
        "threads_manage_replies",
      ],
      redirectUri: `${process.env.APP_URL}/api/v1/auth/callback/threads`,
    };
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();

    // Exchange code for short-lived token
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Threads token exchange failed: ${error}`);
    }

    const shortLived = (await tokenResponse.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
      user_id: string;
    };

    // Exchange for long-lived token (60 days)
    const longLivedResponse = await fetch(
      `${GRAPH_API_BASE}/access_token?` +
        new URLSearchParams({
          grant_type: "th_exchange_token",
          client_secret: config.clientSecret,
          access_token: shortLived.access_token,
        })
    );

    if (!longLivedResponse.ok) {
      // Fall back to short-lived token
      return {
        accessToken: shortLived.access_token,
        refreshToken: null,
        expiresAt: new Date(Date.now() + shortLived.expires_in * 1000),
        scopes: config.scopes,
        tokenType: shortLived.token_type,
        metadata: { userId: shortLived.user_id },
      };
    }

    const longLived = (await longLivedResponse.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    return {
      accessToken: longLived.access_token,
      refreshToken: longLived.access_token, // Long-lived token used for refresh
      expiresAt: new Date(Date.now() + longLived.expires_in * 1000),
      scopes: config.scopes,
      tokenType: longLived.token_type,
      metadata: { userId: shortLived.user_id },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens | null> {
    const response = await fetch(
      `${GRAPH_API_BASE}/refresh_access_token?` +
        new URLSearchParams({
          grant_type: "th_refresh_token",
          access_token: refreshToken,
        })
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: this.getOAuthConfig().scopes,
      tokenType: data.token_type,
    };
  }

  async validateTokens(accessToken: string): Promise<boolean> {
    const response = await fetch(
      `${GRAPH_API_BASE}/me?fields=id&access_token=${accessToken}`
    );
    return response.ok;
  }

  async getProfile(accessToken: string): Promise<PlatformProfile> {
    const response = await fetch(
      `${GRAPH_API_BASE}/me?fields=id,username,threads_profile_picture_url&access_token=${accessToken}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch Threads profile: ${response.statusText}`);
    }
    const data = (await response.json()) as {
      id: string;
      username?: string;
      threads_profile_picture_url?: string;
    };
    return {
      id: data.id,
      name: data.username || data.id,
      handle: data.username ? `@${data.username}` : data.id,
      avatarUrl: data.threads_profile_picture_url,
    };
  }

  async publish(
    accessToken: string,
    content: PostContent
  ): Promise<PublishResult> {
    try {
      const userId = await this.getUserId(accessToken);
      const media = content.media ?? [];
      const images = media.filter((m) => m.type === "image");
      const videos = media.filter((m) => m.type === "video");

      let containerId: string;

      if (images.length > 1) {
        // Carousel post
        containerId = await this.createCarouselContainer(
          accessToken,
          userId,
          images,
          content.text
        );
      } else if (videos.length > 0) {
        // Video post
        containerId = await this.createMediaContainer(accessToken, userId, {
          media_type: "VIDEO",
          video_url: videos[0].url,
          text: this.formatPostText(content),
        });
      } else if (images.length === 1) {
        // Single image post
        containerId = await this.createMediaContainer(accessToken, userId, {
          media_type: "IMAGE",
          image_url: images[0].url,
          text: this.formatPostText(content),
        });
      } else {
        // Text-only post
        containerId = await this.createMediaContainer(accessToken, userId, {
          media_type: "TEXT",
          text: this.formatPostText(content),
        });
      }

      // Wait for container processing, then publish
      await this.waitForContainer(accessToken, containerId);
      const result = await this.publishContainer(accessToken, userId, containerId);

      return {
        success: true,
        platformPostId: result.id,
        platformPostUrl: `https://www.threads.net/@user/post/${result.id}`,
        rawResponse: result,
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
      `${GRAPH_API_BASE}/${platformPostId}/insights?metric=views,likes,replies,reposts,quotes&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Threads analytics: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ name: string; values: Array<{ value: number }> }>;
    };

    const metricsMap: Record<string, number> = {};
    for (const metric of data.data) {
      metricsMap[metric.name] = metric.values[0]?.value ?? 0;
    }

    const views = metricsMap.views ?? 0;
    const likes = metricsMap.likes ?? 0;
    const replies = metricsMap.replies ?? 0;
    const reposts = metricsMap.reposts ?? 0;
    const quotes = metricsMap.quotes ?? 0;

    return {
      impressions: views,
      reach: views,
      likes,
      comments: replies,
      shares: reposts + quotes,
      saves: 0, // Threads doesn't expose saves
      clicks: 0, // Threads doesn't expose clicks
      engagementRate:
        views > 0 ? (likes + replies + reposts + quotes) / views : 0,
      fetchedAt: new Date(),
    };
  }

  async deletePost(
    accessToken: string,
    platformPostId: string
  ): Promise<boolean> {
    const response = await fetch(
      `${GRAPH_API_BASE}/${platformPostId}?access_token=${accessToken}`,
      { method: "DELETE" }
    );
    return response.ok;
  }

  // ---- Private helpers ----

  private async getUserId(accessToken: string): Promise<string> {
    const response = await fetch(
      `${GRAPH_API_BASE}/me?fields=id&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error("Failed to get Threads user ID");
    }

    const data = (await response.json()) as { id: string };
    return data.id;
  }

  private async createMediaContainer(
    accessToken: string,
    userId: string,
    params: Record<string, string>
  ): Promise<string> {
    const response = await fetch(
      `${GRAPH_API_BASE}/${userId}/threads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...params,
          access_token: accessToken,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Threads container creation failed: ${error}`);
    }

    const data = (await response.json()) as { id: string };
    return data.id;
  }

  private async createCarouselContainer(
    accessToken: string,
    userId: string,
    images: NonNullable<PostContent["media"]>,
    caption: string
  ): Promise<string> {
    // Create individual item containers
    const childIds: string[] = [];

    for (const image of images) {
      const childId = await this.createMediaContainer(accessToken, userId, {
        media_type: "IMAGE",
        image_url: image.url,
        is_carousel_item: "true",
      });
      childIds.push(childId);
    }

    // Create carousel container
    const response = await fetch(
      `${GRAPH_API_BASE}/${userId}/threads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: childIds.join(","),
          text: caption,
          access_token: accessToken,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Threads carousel creation failed: ${error}`);
    }

    const data = (await response.json()) as { id: string };
    return data.id;
  }

  private async waitForContainer(
    accessToken: string,
    containerId: string,
    maxAttempts = 30
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(
        `${GRAPH_API_BASE}/${containerId}?fields=status&access_token=${accessToken}`
      );

      if (response.ok) {
        const data = (await response.json()) as { status: string };
        if (data.status === "FINISHED") return;
        if (data.status === "ERROR") {
          throw new Error("Threads media container processing failed");
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("Threads media container processing timed out");
  }

  private async publishContainer(
    accessToken: string,
    userId: string,
    containerId: string
  ): Promise<{ id: string }> {
    const response = await fetch(
      `${GRAPH_API_BASE}/${userId}/threads_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Threads publish failed: ${error}`);
    }

    return (await response.json()) as { id: string };
  }

  private formatPostText(content: PostContent): string {
    let text = content.text;

    if (content.hashtags && content.hashtags.length > 0) {
      const hashtagStr = content.hashtags
        .map((h) => (h.startsWith("#") ? h : `#${h}`))
        .join(" ");
      const combined = `${text}\n\n${hashtagStr}`;
      if (combined.length <= 500) {
        text = combined;
      }
    }

    return text.slice(0, 500);
  }
}
