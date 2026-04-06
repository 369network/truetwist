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
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Facebook platform adapter using Meta Graph API.
 * Supports text posts, photo posts, multi-photo posts, video posts, and link shares.
 */
export class FacebookAdapter extends PlatformAdapter {
  readonly platform = "facebook" as const;
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.facebook;
  readonly rateLimitConfig: RateLimitConfig = PLATFORM_RATE_LIMITS.facebook;

  getOAuthConfig(): OAuthConfig {
    return {
      platform: "facebook",
      clientId: process.env.META_CLIENT_ID!,
      clientSecret: process.env.META_CLIENT_SECRET!,
      authorizationUrl: "https://www.facebook.com/dialog/oauth",
      tokenUrl: `${GRAPH_API_BASE}/oauth/access_token`,
      scopes: [
        "pages_manage_posts",
        "pages_read_engagement",
        "pages_show_list",
        "pages_read_user_content",
        "publish_video",
      ],
      redirectUri: `${process.env.APP_URL}/api/v1/auth/callback/facebook`,
    };
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();

    // Exchange code for short-lived user token
    const tokenResponse = await fetch(
      `${config.tokenUrl}?` +
        new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          code,
        })
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Facebook token exchange failed: ${error}`);
    }

    const shortLived = (await tokenResponse.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    // Exchange for long-lived token (60 days)
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
      throw new Error(`Facebook long-lived token exchange failed: ${error}`);
    }

    const longLived = (await longLivedResponse.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    // Get the Page access token (never expires when derived from long-lived user token)
    const pageToken = await this.getPageAccessToken(longLived.access_token);

    return {
      accessToken: pageToken.accessToken,
      refreshToken: longLived.access_token, // User token used to refresh page tokens
      expiresAt: null, // Page tokens derived from long-lived tokens don't expire
      scopes: config.scopes,
      tokenType: longLived.token_type,
      metadata: { pageId: pageToken.pageId },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens | null> {
    // Refresh the long-lived user token
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

    // Get new page token
    const pageToken = await this.getPageAccessToken(data.access_token);

    return {
      accessToken: pageToken.accessToken,
      refreshToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: this.getOAuthConfig().scopes,
      tokenType: data.token_type,
      metadata: { pageId: pageToken.pageId },
    };
  }

  async validateTokens(accessToken: string): Promise<boolean> {
    const response = await fetch(
      `${GRAPH_API_BASE}/me?access_token=${accessToken}`
    );
    return response.ok;
  }

  async getProfile(accessToken: string): Promise<PlatformProfile> {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name,picture.type(large)&access_token=${accessToken}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch Facebook profile: ${response.statusText}`);
    }
    const data = (await response.json()) as {
      id: string;
      name: string;
      picture?: { data?: { url?: string } };
    };
    return {
      id: data.id,
      name: data.name,
      handle: data.name,
      avatarUrl: data.picture?.data?.url,
    };
  }

  async publish(
    accessToken: string,
    content: PostContent
  ): Promise<PublishResult> {
    try {
      // Get page ID from token debug or use stored metadata
      const pageId = await this.getPageId(accessToken);
      const media = content.media ?? [];
      const videos = media.filter((m) => m.type === "video");
      const images = media.filter((m) => m.type === "image");

      let result: { id: string };

      if (videos.length > 0) {
        result = await this.publishVideo(accessToken, pageId, videos[0].url, content.text);
      } else if (images.length > 0) {
        result = await this.publishPhotos(accessToken, pageId, images, content.text);
      } else {
        // Text-only post (optionally with link)
        result = await this.publishTextPost(accessToken, pageId, content);
      }

      return {
        success: true,
        platformPostId: result.id,
        platformPostUrl: `https://www.facebook.com/${result.id}`,
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
    // Fetch post insights
    const insightsResponse = await fetch(
      `${GRAPH_API_BASE}/${platformPostId}/insights?metric=post_impressions,post_impressions_unique,post_clicks,post_reactions_like_total&access_token=${accessToken}`
    );

    // Fetch basic engagement counts
    const postResponse = await fetch(
      `${GRAPH_API_BASE}/${platformPostId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${accessToken}`
    );

    const metricsMap: Record<string, number> = {};

    if (insightsResponse.ok) {
      const insights = (await insightsResponse.json()) as {
        data: Array<{ name: string; values: Array<{ value: number }> }>;
      };
      for (const metric of insights.data) {
        metricsMap[metric.name] = metric.values[0]?.value ?? 0;
      }
    }

    let likes = 0;
    let comments = 0;
    let shares = 0;

    if (postResponse.ok) {
      const post = (await postResponse.json()) as {
        likes?: { summary: { total_count: number } };
        comments?: { summary: { total_count: number } };
        shares?: { count: number };
      };
      likes = post.likes?.summary.total_count ?? 0;
      comments = post.comments?.summary.total_count ?? 0;
      shares = post.shares?.count ?? 0;
    }

    const impressions = metricsMap.post_impressions ?? 0;
    const clicks = metricsMap.post_clicks ?? 0;

    return {
      impressions,
      reach: metricsMap.post_impressions_unique ?? 0,
      likes,
      comments,
      shares,
      saves: 0, // Facebook doesn't expose save counts via API
      clicks,
      engagementRate:
        impressions > 0 ? (likes + comments + shares + clicks) / impressions : 0,
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

  private async getPageAccessToken(
    userToken: string
  ): Promise<{ accessToken: string; pageId: string }> {
    const response = await fetch(
      `${GRAPH_API_BASE}/me/accounts?access_token=${userToken}`
    );

    if (!response.ok) {
      throw new Error("Failed to retrieve Facebook Page access token");
    }

    const data = (await response.json()) as {
      data: Array<{ id: string; access_token: string; name: string }>;
    };

    if (data.data.length === 0) {
      throw new Error("No Facebook Pages found for this account");
    }

    // Use the first page by default
    return {
      accessToken: data.data[0].access_token,
      pageId: data.data[0].id,
    };
  }

  private async getPageId(accessToken: string): Promise<string> {
    const response = await fetch(
      `${GRAPH_API_BASE}/me?fields=id&access_token=${accessToken}`
    );
    const data = (await response.json()) as { id: string };
    return data.id;
  }

  private async publishTextPost(
    accessToken: string,
    pageId: string,
    content: PostContent
  ): Promise<{ id: string }> {
    const body: Record<string, string> = {
      message: this.formatPostText(content),
      access_token: accessToken,
    };

    if (content.link) {
      body.link = content.link;
    }

    const response = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook text post failed: ${error}`);
    }

    return (await response.json()) as { id: string };
  }

  private async publishPhotos(
    accessToken: string,
    pageId: string,
    images: PostContent["media"] & Array<unknown>,
    caption: string
  ): Promise<{ id: string }> {
    if (images.length === 1) {
      // Single photo post
      const response = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: images[0].url,
          message: caption,
          access_token: accessToken,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Facebook photo post failed: ${error}`);
      }

      return (await response.json()) as { id: string };
    }

    // Multi-photo: upload each as unpublished, then create feed post
    const photoIds: string[] = [];
    for (const image of images) {
      const response = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: image.url,
          published: false,
          access_token: accessToken,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Facebook photo upload failed: ${error}`);
      }

      const data = (await response.json()) as { id: string };
      photoIds.push(data.id);
    }

    // Create multi-photo post
    const attachedMedia: Record<string, string> = {};
    photoIds.forEach((id, i) => {
      attachedMedia[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
    });

    const response = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: caption,
        access_token: accessToken,
        ...attachedMedia,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook multi-photo post failed: ${error}`);
    }

    return (await response.json()) as { id: string };
  }

  private async publishVideo(
    accessToken: string,
    pageId: string,
    videoUrl: string,
    description: string
  ): Promise<{ id: string }> {
    const response = await fetch(`${GRAPH_API_BASE}/${pageId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: videoUrl,
        description,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook video post failed: ${error}`);
    }

    return (await response.json()) as { id: string };
  }

  private formatPostText(content: PostContent): string {
    let text = content.text;

    if (content.hashtags && content.hashtags.length > 0) {
      const hashtagStr = content.hashtags
        .map((h) => (h.startsWith("#") ? h : `#${h}`))
        .join(" ");
      text = `${text}\n\n${hashtagStr}`;
    }

    return text;
  }
}
