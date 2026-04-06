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

const PINTEREST_API_BASE = "https://api.pinterest.com/v5";
const PINTEREST_AUTH_BASE = "https://www.pinterest.com/oauth";

/**
 * Pinterest platform adapter using Pinterest API v5.
 * Supports Pin creation (image and video), board management, and analytics.
 */
export class PinterestAdapter extends PlatformAdapter {
  readonly platform = "pinterest" as const;
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.pinterest;
  readonly rateLimitConfig: RateLimitConfig = PLATFORM_RATE_LIMITS.pinterest;

  getOAuthConfig(): OAuthConfig {
    return {
      platform: "pinterest",
      clientId: process.env.PINTEREST_APP_ID!,
      clientSecret: process.env.PINTEREST_APP_SECRET!,
      authorizationUrl: PINTEREST_AUTH_BASE,
      tokenUrl: `${PINTEREST_API_BASE}/oauth/token`,
      scopes: ["boards:read", "boards:write", "pins:read", "pins:write"],
      redirectUri: `${process.env.APP_URL}/api/v1/auth/callback/pinterest`,
    };
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinterest token exchange failed: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      refresh_token_expires_in: number;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope.split(","),
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
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope.split(","),
      tokenType: data.token_type,
    };
  }

  async validateTokens(accessToken: string): Promise<boolean> {
    const response = await fetch(`${PINTEREST_API_BASE}/user_account`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.ok;
  }

  async getProfile(accessToken: string): Promise<PlatformProfile> {
    const response = await fetch(`${PINTEREST_API_BASE}/user_account`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch Pinterest profile: ${response.statusText}`);
    }
    const data = (await response.json()) as {
      username: string;
      profile_image?: string;
      follower_count?: number;
    };
    return {
      id: data.username,
      name: data.username,
      handle: `@${data.username}`,
      avatarUrl: data.profile_image,
      followerCount: data.follower_count,
    };
  }

  async publish(
    accessToken: string,
    content: PostContent
  ): Promise<PublishResult> {
    try {
      const media = content.media ?? [];
      const images = media.filter((m) => m.type === "image");
      const videos = media.filter((m) => m.type === "video");

      if (images.length === 0 && videos.length === 0) {
        return { success: false, error: "Pinterest requires at least one image or video" };
      }

      if (videos.length > 0) {
        return await this.createVideoPin(accessToken, content, videos[0].url);
      }

      return await this.createImagePin(accessToken, content, images[0].url);
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
      `${PINTEREST_API_BASE}/pins/${platformPostId}/analytics?start_date=${this.daysAgo(30)}&end_date=${this.today()}&metric_types=IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE,CLOSEUP`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Pinterest analytics: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      all: {
        lifetime_metrics: {
          IMPRESSION?: number;
          PIN_CLICK?: number;
          OUTBOUND_CLICK?: number;
          SAVE?: number;
          CLOSEUP?: number;
        };
      };
    };

    const metrics = data.all?.lifetime_metrics ?? {};
    const impressions = metrics.IMPRESSION ?? 0;
    const pinClicks = metrics.PIN_CLICK ?? 0;
    const outboundClicks = metrics.OUTBOUND_CLICK ?? 0;
    const saves = metrics.SAVE ?? 0;

    return {
      impressions,
      reach: impressions, // Pinterest doesn't distinguish reach
      likes: 0, // Pinterest uses "saves" instead of "likes"
      comments: 0, // Not available in pin analytics
      shares: 0, // Pinterest doesn't have shares
      saves,
      clicks: pinClicks + outboundClicks,
      engagementRate:
        impressions > 0 ? (saves + pinClicks + outboundClicks) / impressions : 0,
      fetchedAt: new Date(),
    };
  }

  async deletePost(
    accessToken: string,
    platformPostId: string
  ): Promise<boolean> {
    const response = await fetch(
      `${PINTEREST_API_BASE}/pins/${platformPostId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.ok || response.status === 204;
  }

  // ---- Private helpers ----

  private async createImagePin(
    accessToken: string,
    content: PostContent,
    imageUrl: string
  ): Promise<PublishResult> {
    const pinData: Record<string, unknown> = {
      title: content.text.slice(0, 100),
      description: this.formatDescription(content),
      media_source: {
        source_type: "image_url",
        url: imageUrl,
      },
    };

    if (content.link) {
      pinData.link = content.link;
    }

    const response = await fetch(`${PINTEREST_API_BASE}/pins`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pinData),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Pinterest pin creation failed: ${error}` };
    }

    const result = (await response.json()) as {
      id: string;
      link?: string;
    };

    return {
      success: true,
      platformPostId: result.id,
      platformPostUrl: `https://www.pinterest.com/pin/${result.id}/`,
      rawResponse: result,
    };
  }

  private async createVideoPin(
    accessToken: string,
    content: PostContent,
    videoUrl: string
  ): Promise<PublishResult> {
    // Step 1: Register media upload
    const registerResponse = await fetch(`${PINTEREST_API_BASE}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ media_type: "video" }),
    });

    if (!registerResponse.ok) {
      const error = await registerResponse.text();
      return { success: false, error: `Pinterest media register failed: ${error}` };
    }

    const registerData = (await registerResponse.json()) as {
      media_id: string;
      upload_url: string;
      upload_parameters: Record<string, string>;
    };

    // Step 2: Upload video to the provided URL
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      return { success: false, error: `Failed to download video: ${videoUrl}` };
    }
    const videoBuffer = await videoResponse.arrayBuffer();

    // Pinterest uses multipart form upload
    const formData = new FormData();
    for (const [key, value] of Object.entries(registerData.upload_parameters)) {
      formData.append(key, value);
    }
    formData.append("file", new Blob([videoBuffer], { type: "video/mp4" }));

    const uploadResponse = await fetch(registerData.upload_url, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      return { success: false, error: "Pinterest video upload failed" };
    }

    // Step 3: Wait for media processing
    await this.waitForMediaReady(accessToken, registerData.media_id);

    // Step 4: Create pin with the processed media
    const pinData: Record<string, unknown> = {
      title: content.text.slice(0, 100),
      description: this.formatDescription(content),
      media_source: {
        source_type: "video_id",
        media_id: registerData.media_id,
      },
    };

    if (content.link) {
      pinData.link = content.link;
    }

    const pinResponse = await fetch(`${PINTEREST_API_BASE}/pins`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pinData),
    });

    if (!pinResponse.ok) {
      const error = await pinResponse.text();
      return { success: false, error: `Pinterest video pin failed: ${error}` };
    }

    const result = (await pinResponse.json()) as { id: string };

    return {
      success: true,
      platformPostId: result.id,
      platformPostUrl: `https://www.pinterest.com/pin/${result.id}/`,
      rawResponse: result,
    };
  }

  private async waitForMediaReady(
    accessToken: string,
    mediaId: string,
    maxAttempts = 30
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(
        `${PINTEREST_API_BASE}/media/${mediaId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (response.ok) {
        const data = (await response.json()) as { status: string };
        if (data.status === "succeeded") return;
        if (data.status === "failed") {
          throw new Error("Pinterest media processing failed");
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    throw new Error("Pinterest media processing timed out");
  }

  private formatDescription(content: PostContent): string {
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

  private today(): string {
    return new Date().toISOString().split("T")[0];
  }

  private daysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  }
}
