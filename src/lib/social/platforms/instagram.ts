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

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Instagram platform adapter using Meta Graph API.
 * Supports single image, carousel, and Reels publishing.
 */
export class InstagramAdapter extends PlatformAdapter {
  readonly platform = "instagram" as const;
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.instagram;
  readonly rateLimitConfig: RateLimitConfig = PLATFORM_RATE_LIMITS.instagram;

  getOAuthConfig(): OAuthConfig {
    return {
      platform: "instagram",
      clientId: process.env.META_CLIENT_ID!,
      clientSecret: process.env.META_CLIENT_SECRET!,
      authorizationUrl: "https://www.facebook.com/dialog/oauth",
      tokenUrl: `${GRAPH_API_BASE}/oauth/access_token`,
      scopes: [
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_insights",
        "pages_show_list",
        "pages_read_engagement",
      ],
      redirectUri: `${process.env.APP_URL}/api/v1/auth/callback/instagram`,
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
      throw new Error(`Instagram token exchange failed: ${error}`);
    }

    const shortLived = (await tokenResponse.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    // Exchange short-lived token for long-lived token (60 days)
    const longLivedResponse = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          fb_exchange_token: shortLived.access_token,
        })
    );

    if (!longLivedResponse.ok) {
      const error = await longLivedResponse.text();
      throw new Error(`Instagram long-lived token exchange failed: ${error}`);
    }

    const longLived = (await longLivedResponse.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    return {
      accessToken: longLived.access_token,
      refreshToken: longLived.access_token, // Meta uses the long-lived token itself for refresh
      expiresAt: new Date(Date.now() + longLived.expires_in * 1000),
      scopes: config.scopes,
      tokenType: longLived.token_type,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens | null> {
    // Meta refreshes long-lived tokens by calling the same endpoint
    const response = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: process.env.META_CLIENT_ID!,
          client_secret: process.env.META_CLIENT_SECRET!,
          fb_exchange_token: refreshToken,
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
      `${GRAPH_API_BASE}/me?access_token=${accessToken}`
    );
    return response.ok;
  }

  async getProfile(accessToken: string): Promise<PlatformProfile> {
    const igAccountId = await this.getInstagramAccountId(accessToken);

    const response = await fetch(
      `${GRAPH_API_BASE}/${igAccountId}?fields=name,username,profile_picture_url,followers_count&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Instagram profile: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      id: string;
      name?: string;
      username: string;
      profile_picture_url?: string;
      followers_count?: number;
    };

    return {
      id: data.id,
      name: data.name || data.username,
      handle: `@${data.username}`,
      avatarUrl: data.profile_picture_url,
      followerCount: data.followers_count,
    };
  }

  async publish(
    accessToken: string,
    content: PostContent
  ): Promise<PublishResult> {
    try {
      // Get the Instagram Business Account ID
      const igAccountId = await this.getInstagramAccountId(accessToken);

      const media = content.media ?? [];
      const images = media.filter((m) => m.type === "image");
      const videos = media.filter((m) => m.type === "video");

      let containerId: string;

      if (videos.length > 0) {
        // Reels publishing
        containerId = await this.createReelsContainer(
          accessToken,
          igAccountId,
          videos[0].url,
          content.text
        );
      } else if (images.length > 1) {
        // Carousel publishing
        containerId = await this.createCarouselContainer(
          accessToken,
          igAccountId,
          images.map((i) => i.url),
          content.text
        );
      } else if (images.length === 1) {
        // Single image publishing
        containerId = await this.createImageContainer(
          accessToken,
          igAccountId,
          images[0].url,
          content.text
        );
      } else {
        return { success: false, error: "Instagram requires at least one media item" };
      }

      // Wait for container to be ready, then publish
      await this.waitForContainer(accessToken, containerId);
      const result = await this.publishContainer(
        accessToken,
        igAccountId,
        containerId
      );

      return {
        success: true,
        platformPostId: result.id,
        platformPostUrl: `https://www.instagram.com/p/${result.id}/`,
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
    const metrics = "impressions,reach,likes,comments,shares,saved";
    const response = await fetch(
      `${GRAPH_API_BASE}/${platformPostId}/insights?metric=${metrics}&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Instagram analytics: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ name: string; values: Array<{ value: number }> }>;
    };

    const metricsMap: Record<string, number> = {};
    for (const metric of data.data) {
      metricsMap[metric.name] = metric.values[0]?.value ?? 0;
    }

    const impressions = metricsMap.impressions ?? 0;
    const likes = metricsMap.likes ?? 0;
    const comments = metricsMap.comments ?? 0;
    const shares = metricsMap.shares ?? 0;
    const saves = metricsMap.saved ?? 0;

    return {
      impressions,
      reach: metricsMap.reach ?? 0,
      likes,
      comments,
      shares,
      saves,
      clicks: 0, // Instagram doesn't provide click metrics on posts
      engagementRate:
        impressions > 0
          ? (likes + comments + shares + saves) / impressions
          : 0,
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

  private async getInstagramAccountId(accessToken: string): Promise<string> {
    const response = await fetch(
      `${GRAPH_API_BASE}/me/accounts?access_token=${accessToken}`
    );
    const pages = (await response.json()) as {
      data: Array<{ id: string; instagram_business_account?: { id: string } }>;
    };

    for (const page of pages.data) {
      if (page.instagram_business_account) {
        return page.instagram_business_account.id;
      }
    }

    // Try fetching IG account from the first page
    if (pages.data.length > 0) {
      const pageResponse = await fetch(
        `${GRAPH_API_BASE}/${pages.data[0].id}?fields=instagram_business_account&access_token=${accessToken}`
      );
      const pageData = (await pageResponse.json()) as {
        instagram_business_account?: { id: string };
      };
      if (pageData.instagram_business_account) {
        return pageData.instagram_business_account.id;
      }
    }

    throw new Error("No Instagram Business Account found");
  }

  private async createImageContainer(
    accessToken: string,
    igAccountId: string,
    imageUrl: string,
    caption: string
  ): Promise<string> {
    const response = await fetch(
      `${GRAPH_API_BASE}/${igAccountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: accessToken,
        }),
      }
    );
    const data = (await response.json()) as { id: string };
    return data.id;
  }

  private async createCarouselContainer(
    accessToken: string,
    igAccountId: string,
    imageUrls: string[],
    caption: string
  ): Promise<string> {
    // Create individual media containers for each image
    const childIds: string[] = [];
    for (const url of imageUrls) {
      const response = await fetch(
        `${GRAPH_API_BASE}/${igAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: url,
            is_carousel_item: true,
            access_token: accessToken,
          }),
        }
      );
      const data = (await response.json()) as { id: string };
      childIds.push(data.id);
    }

    // Create carousel container
    const response = await fetch(
      `${GRAPH_API_BASE}/${igAccountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          caption,
          children: childIds,
          access_token: accessToken,
        }),
      }
    );
    const data = (await response.json()) as { id: string };
    return data.id;
  }

  private async createReelsContainer(
    accessToken: string,
    igAccountId: string,
    videoUrl: string,
    caption: string
  ): Promise<string> {
    const response = await fetch(
      `${GRAPH_API_BASE}/${igAccountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "REELS",
          video_url: videoUrl,
          caption,
          access_token: accessToken,
        }),
      }
    );
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
        `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
      );
      const data = (await response.json()) as { status_code: string };

      if (data.status_code === "FINISHED") return;
      if (data.status_code === "ERROR") {
        throw new Error("Instagram media container processing failed");
      }

      // Wait 2 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("Instagram media container processing timed out");
  }

  private async publishContainer(
    accessToken: string,
    igAccountId: string,
    containerId: string
  ): Promise<{ id: string }> {
    const response = await fetch(
      `${GRAPH_API_BASE}/${igAccountId}/media_publish`,
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
      throw new Error(`Instagram publish failed: ${error}`);
    }

    return (await response.json()) as { id: string };
  }
}
