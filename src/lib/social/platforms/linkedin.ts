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

const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";
const LINKEDIN_AUTH_BASE = "https://www.linkedin.com/oauth/v2";

/**
 * LinkedIn platform adapter using LinkedIn Marketing API v2.
 * Supports text posts, image posts, video posts, and article shares.
 */
export class LinkedInAdapter extends PlatformAdapter {
  readonly platform = "linkedin" as const;
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.linkedin;
  readonly rateLimitConfig: RateLimitConfig = PLATFORM_RATE_LIMITS.linkedin;

  getOAuthConfig(): OAuthConfig {
    return {
      platform: "linkedin",
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      authorizationUrl: `${LINKEDIN_AUTH_BASE}/authorization`,
      tokenUrl: `${LINKEDIN_AUTH_BASE}/accessToken`,
      scopes: ["w_member_social", "r_liteprofile", "r_organization_social"],
      redirectUri: `${process.env.APP_URL}/api/v1/auth/callback/linkedin`,
    };
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LinkedIn token exchange failed: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      refresh_token_expires_in?: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: config.scopes,
      tokenType: "Bearer",
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens | null> {
    const config = this.getOAuthConfig();

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: config.scopes,
      tokenType: "Bearer",
    };
  }

  async validateTokens(accessToken: string): Promise<boolean> {
    const response = await fetch(`${LINKEDIN_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.ok;
  }

  async getProfile(accessToken: string): Promise<PlatformProfile> {
    const response = await fetch(
      'https://api.linkedin.com/v2/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch LinkedIn profile: ${response.statusText}`);
    }
    const data = (await response.json()) as {
      sub: string;
      name: string;
      email?: string;
      picture?: string;
    };
    return {
      id: data.sub,
      name: data.name,
      handle: data.email || data.name,
      avatarUrl: data.picture,
    };
  }

  async publish(
    accessToken: string,
    content: PostContent
  ): Promise<PublishResult> {
    try {
      const authorUrn = await this.getAuthorUrn(accessToken);
      const media = content.media ?? [];
      const images = media.filter((m) => m.type === "image");
      const videos = media.filter((m) => m.type === "video");

      let shareContent: Record<string, unknown>;

      if (videos.length > 0) {
        const videoAsset = await this.uploadVideo(accessToken, authorUrn, videos[0].url);
        shareContent = this.buildVideoShareContent(authorUrn, content, videoAsset);
      } else if (images.length > 0) {
        const imageAssets = await this.uploadImages(accessToken, authorUrn, images);
        shareContent = this.buildImageShareContent(authorUrn, content, imageAssets);
      } else {
        shareContent = this.buildTextShareContent(authorUrn, content);
      }

      const response = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(shareContent),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `LinkedIn post failed: ${error}` };
      }

      const postId = response.headers.get("X-RestLi-Id") ?? "";

      return {
        success: true,
        platformPostId: postId,
        platformPostUrl: `https://www.linkedin.com/feed/update/${postId}`,
        rawResponse: { id: postId },
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
    // Fetch social actions (likes, comments, shares)
    const socialResponse = await fetch(
      `${LINKEDIN_API_BASE}/socialActions/${encodeURIComponent(platformPostId)}?fields=likes,comments,shares`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let likes = 0;
    let comments = 0;
    let shares = 0;

    if (socialResponse.ok) {
      const social = (await socialResponse.json()) as {
        likes?: { paging: { total: number } };
        comments?: { paging: { total: number } };
        shares?: { paging: { total: number } };
      };
      likes = social.likes?.paging.total ?? 0;
      comments = social.comments?.paging.total ?? 0;
      shares = social.shares?.paging.total ?? 0;
    }

    // Fetch share statistics for impressions/clicks
    const statsResponse = await fetch(
      `${LINKEDIN_API_BASE}/organizationalEntityShareStatistics?q=organizationalEntity&shares=List(${encodeURIComponent(platformPostId)})`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let impressions = 0;
    let clicks = 0;
    let reach = 0;

    if (statsResponse.ok) {
      const stats = (await statsResponse.json()) as {
        elements: Array<{
          totalShareStatistics: {
            impressionCount: number;
            clickCount: number;
            uniqueImpressionsCount: number;
          };
        }>;
      };
      if (stats.elements.length > 0) {
        const s = stats.elements[0].totalShareStatistics;
        impressions = s.impressionCount ?? 0;
        clicks = s.clickCount ?? 0;
        reach = s.uniqueImpressionsCount ?? 0;
      }
    }

    return {
      impressions,
      reach,
      likes,
      comments,
      shares,
      saves: 0, // LinkedIn doesn't expose saves
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
      `${LINKEDIN_API_BASE}/ugcPosts/${encodeURIComponent(platformPostId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );
    return response.ok;
  }

  // ---- Private helpers ----

  private async getAuthorUrn(accessToken: string): Promise<string> {
    const response = await fetch(`${LINKEDIN_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error("Failed to get LinkedIn user profile");
    }

    const data = (await response.json()) as { id: string };
    return `urn:li:person:${data.id}`;
  }

  private buildTextShareContent(
    authorUrn: string,
    content: PostContent
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: this.formatPostText(content) },
          shareMediaCategory: content.link ? "ARTICLE" : "NONE",
          ...(content.link
            ? {
                media: [
                  {
                    status: "READY",
                    originalUrl: content.link,
                  },
                ],
              }
            : {}),
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };
    return body;
  }

  private buildImageShareContent(
    authorUrn: string,
    content: PostContent,
    imageAssets: string[]
  ): Record<string, unknown> {
    return {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: this.formatPostText(content) },
          shareMediaCategory: "IMAGE",
          media: imageAssets.map((asset) => ({
            status: "READY",
            media: asset,
          })),
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };
  }

  private buildVideoShareContent(
    authorUrn: string,
    content: PostContent,
    videoAsset: string
  ): Record<string, unknown> {
    return {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: this.formatPostText(content) },
          shareMediaCategory: "VIDEO",
          media: [{ status: "READY", media: videoAsset }],
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };
  }

  private async uploadImages(
    accessToken: string,
    authorUrn: string,
    images: PostContent["media"] & Array<unknown>
  ): Promise<string[]> {
    const assets: string[] = [];

    for (const image of images) {
      // Register upload
      const registerResponse = await fetch(
        `${LINKEDIN_API_BASE}/assets?action=registerUpload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
              owner: authorUrn,
              serviceRelationships: [
                {
                  relationshipType: "OWNER",
                  identifier: "urn:li:userGeneratedContent",
                },
              ],
            },
          }),
        }
      );

      if (!registerResponse.ok) {
        throw new Error("Failed to register LinkedIn image upload");
      }

      const registerData = (await registerResponse.json()) as {
        value: {
          uploadMechanism: {
            "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
              uploadUrl: string;
            };
          };
          asset: string;
        };
      };

      const uploadUrl =
        registerData.value.uploadMechanism[
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
        ].uploadUrl;
      const asset = registerData.value.asset;

      // Download and upload the image
      const imageResponse = await fetch(image.url);
      if (!imageResponse.ok) throw new Error(`Failed to download image: ${image.url}`);
      const imageBuffer = await imageResponse.arrayBuffer();

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": image.mimeType ?? "image/jpeg",
        },
        body: imageBuffer,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image to LinkedIn");
      }

      assets.push(asset);
    }

    return assets;
  }

  private async uploadVideo(
    accessToken: string,
    authorUrn: string,
    videoUrl: string
  ): Promise<string> {
    // Register video upload
    const registerResponse = await fetch(
      `${LINKEDIN_API_BASE}/assets?action=registerUpload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
            owner: authorUrn,
            serviceRelationships: [
              {
                relationshipType: "OWNER",
                identifier: "urn:li:userGeneratedContent",
              },
            ],
          },
        }),
      }
    );

    if (!registerResponse.ok) {
      throw new Error("Failed to register LinkedIn video upload");
    }

    const registerData = (await registerResponse.json()) as {
      value: {
        uploadMechanism: {
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
            uploadUrl: string;
          };
        };
        asset: string;
      };
    };

    const uploadUrl =
      registerData.value.uploadMechanism[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ].uploadUrl;
    const asset = registerData.value.asset;

    // Download and upload the video
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error(`Failed to download video: ${videoUrl}`);
    const videoBuffer = await videoResponse.arrayBuffer();

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "video/mp4",
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload video to LinkedIn");
    }

    return asset;
  }

  private formatPostText(content: PostContent): string {
    let text = content.text;

    if (content.hashtags && content.hashtags.length > 0) {
      const hashtagStr = content.hashtags
        .map((h) => (h.startsWith("#") ? h : `#${h}`))
        .join(" ");
      const combined = `${text}\n\n${hashtagStr}`;
      if (combined.length <= 3000) {
        text = combined;
      }
    }

    return text;
  }
}
