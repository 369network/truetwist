/**
 * Tests for social platform adapters — registry, base class validation,
 * OAuth config, token exchange, profile, publish, analytics, delete.
 *
 * Mocks global fetch to intercept all HTTP calls to platform APIs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set required env vars before imports
process.env.TWITTER_CLIENT_ID = 'test-twitter-id';
process.env.TWITTER_CLIENT_SECRET = 'test-twitter-secret';
process.env.META_CLIENT_ID = 'test-meta-id';
process.env.META_CLIENT_SECRET = 'test-meta-secret';
process.env.LINKEDIN_CLIENT_ID = 'test-li-id';
process.env.LINKEDIN_CLIENT_SECRET = 'test-li-secret';
process.env.TIKTOK_CLIENT_KEY = 'test-tt-key';
process.env.TIKTOK_CLIENT_SECRET = 'test-tt-secret';
process.env.GOOGLE_CLIENT_ID = 'test-google-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
process.env.PINTEREST_APP_ID = 'test-pin-id';
process.env.PINTEREST_APP_SECRET = 'test-pin-secret';
process.env.THREADS_APP_ID = 'test-threads-id';
process.env.THREADS_APP_SECRET = 'test-threads-secret';
process.env.APP_URL = 'https://app.truetwist.com';

import { getPlatformAdapter, getAllAdapters, isPlatformSupported } from '../platforms/index';
import { TwitterAdapter } from '../platforms/twitter';
import { InstagramAdapter } from '../platforms/instagram';
import { FacebookAdapter } from '../platforms/facebook';
import { LinkedInAdapter } from '../platforms/linkedin';
import { TikTokAdapter } from '../platforms/tiktok';
import { YouTubeAdapter } from '../platforms/youtube';
import { PinterestAdapter } from '../platforms/pinterest';
import { ThreadsAdapter } from '../platforms/threads';
import type { PostContent } from '../types';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Registry Tests ──

describe('Platform adapter registry', () => {
  it('should return adapter for all 8 supported platforms', () => {
    const platforms = ['twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads'] as const;
    for (const p of platforms) {
      const adapter = getPlatformAdapter(p);
      expect(adapter).toBeTruthy();
      expect(adapter.platform).toBe(p);
    }
  });

  it('should throw for unsupported platform', () => {
    expect(() => getPlatformAdapter('mastodon' as any)).toThrow('not supported');
  });

  it('getAllAdapters should return 8 adapters', () => {
    expect(getAllAdapters()).toHaveLength(8);
  });

  it('isPlatformSupported should return true/false correctly', () => {
    expect(isPlatformSupported('twitter')).toBe(true);
    expect(isPlatformSupported('mastodon' as any)).toBe(false);
  });
});

// ── Content Validation (base class) ──

describe('PlatformAdapter.validateContent', () => {
  const twitter = getPlatformAdapter('twitter');

  it('should pass valid content', () => {
    const content: PostContent = { text: 'Hello world!', media: [], hashtags: [] };
    expect(twitter.validateContent(content)).toEqual([]);
  });

  it('should reject text exceeding platform limit', () => {
    const content: PostContent = { text: 'x'.repeat(281), media: [], hashtags: [] };
    const errors = twitter.validateContent(content);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('280');
  });

  it('should reject too many hashtags', () => {
    const content: PostContent = {
      text: 'Test',
      media: [],
      hashtags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    };
    const errors = twitter.validateContent(content);
    expect(errors.some(e => e.includes('hashtag'))).toBe(true);
  });

  it('should reject too many images', () => {
    const content: PostContent = {
      text: 'Test',
      media: Array.from({ length: 5 }, () => ({ type: 'image' as const, url: 'https://img.test/1.jpg' })),
      hashtags: [],
    };
    const errors = twitter.validateContent(content);
    expect(errors.some(e => e.includes('image'))).toBe(true);
  });

  it('should reject oversized media', () => {
    const content: PostContent = {
      text: 'Test',
      media: [{ type: 'image' as const, url: 'https://img.test/big.jpg', sizeBytes: 10 * 1024 * 1024 }],
      hashtags: [],
    };
    const errors = twitter.validateContent(content);
    expect(errors.some(e => e.includes('size'))).toBe(true);
  });

  it('should reject unsupported media format', () => {
    const content: PostContent = {
      text: 'Test',
      media: [{ type: 'image' as const, url: 'https://img.test/img.bmp', mimeType: 'image/bmp' }],
      hashtags: [],
    };
    const errors = twitter.validateContent(content);
    expect(errors.some(e => e.includes('Unsupported'))).toBe(true);
  });

  it('should validate Instagram constraints (2200 chars, 10 images)', () => {
    const ig = getPlatformAdapter('instagram');
    expect(ig.validateContent({ text: 'x'.repeat(2200), media: [], hashtags: [] })).toEqual([]);
    expect(ig.validateContent({ text: 'x'.repeat(2201), media: [], hashtags: [] }).length).toBeGreaterThan(0);
  });

  it('should validate LinkedIn constraints (3000 chars)', () => {
    const li = getPlatformAdapter('linkedin');
    expect(li.validateContent({ text: 'x'.repeat(3000), media: [], hashtags: [] })).toEqual([]);
    expect(li.validateContent({ text: 'x'.repeat(3001), media: [], hashtags: [] }).length).toBeGreaterThan(0);
  });
});

// ── OAuth Config Tests ──

describe('Adapter OAuth config', () => {
  const adapters = getAllAdapters();

  it.each(adapters.map(a => [a.platform, a]))('should return valid OAuth config for %s', (_name, adapter) => {
    const config = adapter.getOAuthConfig();
    expect(config.platform).toBe(adapter.platform);
    expect(config.clientId).toBeTruthy();
    expect(config.clientSecret).toBeTruthy();
    expect(config.authorizationUrl).toContain('http');
    expect(config.tokenUrl).toContain('http');
    expect(config.scopes.length).toBeGreaterThan(0);
    expect(config.redirectUri).toContain('truetwist.com');
  });
});

// ── Constraints & Rate Limits ──

describe('Adapter constraints', () => {
  const adapters = getAllAdapters();

  it.each(adapters.map(a => [a.platform, a]))('%s should have valid constraints', (_name, adapter) => {
    const c = adapter.constraints;
    expect(c.maxTextLength).toBeGreaterThan(0);
    expect(c.maxImages).toBeGreaterThanOrEqual(0);
    expect(c.maxVideoSizeBytes).toBeGreaterThan(0);
    expect(c.maxImageSizeBytes).toBeGreaterThan(0);
    expect(c.supportedImageFormats.length).toBeGreaterThan(0);
    expect(c.supportedVideoFormats.length).toBeGreaterThan(0);
  });

  it.each(adapters.map(a => [a.platform, a]))('%s should have valid rate limit config', (_name, adapter) => {
    const r = adapter.rateLimitConfig;
    expect(r.maxRequests).toBeGreaterThan(0);
    expect(r.windowSeconds).toBeGreaterThan(0);
    expect(r.description).toBeTruthy();
  });
});

// ── Twitter Adapter (detailed) ──

describe('TwitterAdapter', () => {
  const twitter = new TwitterAdapter();

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'tw-access-123',
          refresh_token: 'tw-refresh-456',
          expires_in: 7200,
          token_type: 'bearer',
          scope: 'tweet.read tweet.write',
        }),
      });

      const tokens = await twitter.exchangeCodeForTokens('auth-code-123', 'verifier-456');
      expect(tokens.accessToken).toBe('tw-access-123');
      expect(tokens.refreshToken).toBe('tw-refresh-456');
      expect(tokens.scopes).toEqual(['tweet.read', 'tweet.write']);
      expect(tokens.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw on failed token exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'invalid_grant',
      });

      await expect(twitter.exchangeCodeForTokens('bad-code')).rejects.toThrow('token exchange failed');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 7200,
          token_type: 'bearer',
          scope: 'tweet.read tweet.write',
        }),
      });

      const tokens = await twitter.refreshAccessToken('old-refresh');
      expect(tokens?.accessToken).toBe('new-access');
    });

    it('should return null on refresh failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      const result = await twitter.refreshAccessToken('expired-refresh');
      expect(result).toBeNull();
    });
  });

  describe('validateTokens', () => {
    it('should return true for valid token', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      expect(await twitter.validateTokens('valid-token')).toBe(true);
    });

    it('should return false for invalid token', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      expect(await twitter.validateTokens('invalid-token')).toBe(false);
    });
  });

  describe('getProfile', () => {
    it('should fetch and normalize profile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: '123456',
            name: 'Test User',
            username: 'testuser',
            profile_image_url: 'https://pbs.twimg.com/123.jpg',
            public_metrics: { followers_count: 5000 },
          },
        }),
      });

      const profile = await twitter.getProfile('access-token');
      expect(profile.id).toBe('123456');
      expect(profile.name).toBe('Test User');
      expect(profile.handle).toBe('@testuser');
      expect(profile.followerCount).toBe(5000);
    });

    it('should throw on profile fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Unauthorized' });
      await expect(twitter.getProfile('bad-token')).rejects.toThrow('Failed to fetch');
    });
  });

  describe('publish', () => {
    it('should publish text tweet', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'tweet-789', text: 'Hello world' },
        }),
      });

      const result = await twitter.publish('access-token', {
        text: 'Hello world',
        media: [],
        hashtags: [],
      });

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('tweet-789');
      expect(result.platformPostUrl).toContain('tweet-789');
    });

    it('should return error on publish failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Rate limited',
      });

      const result = await twitter.publish('access-token', {
        text: 'Hello',
        media: [],
        hashtags: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limited');
    });
  });

  describe('fetchAnalytics', () => {
    it('should normalize Twitter metrics to PostAnalytics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            public_metrics: {
              impression_count: 10000,
              like_count: 200,
              reply_count: 50,
              retweet_count: 75,
              quote_count: 25,
              bookmark_count: 30,
            },
            non_public_metrics: {
              url_link_clicks: 150,
              user_profile_clicks: 80,
            },
          },
        }),
      });

      const analytics = await twitter.fetchAnalytics('token', 'tweet-789');
      expect(analytics.impressions).toBe(10000);
      expect(analytics.likes).toBe(200);
      expect(analytics.comments).toBe(50);
      expect(analytics.shares).toBe(100); // retweets + quotes
      expect(analytics.saves).toBe(30); // bookmarks
      expect(analytics.clicks).toBe(150);
      expect(analytics.engagementRate).toBeCloseTo(0.038); // (200+50+75+25+30)/10000
      expect(analytics.fetchedAt).toBeInstanceOf(Date);
    });

    it('should throw on analytics fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Not Found' });
      await expect(twitter.fetchAnalytics('token', 'bad-id')).rejects.toThrow('Failed to fetch');
    });
  });

  describe('deletePost', () => {
    it('should delete tweet successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { deleted: true } }),
      });

      const result = await twitter.deletePost('token', 'tweet-789');
      expect(result).toBe(true);
    });

    it('should return false on delete failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      const result = await twitter.deletePost('token', 'bad-id');
      expect(result).toBe(false);
    });
  });
});

// ── Instagram Adapter ──

describe('InstagramAdapter', () => {
  const ig = new InstagramAdapter();

  describe('exchangeCodeForTokens', () => {
    it('should exchange code and get long-lived token', async () => {
      // Short-lived token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'short-lived-token',
          user_id: 'ig-user-123',
        }),
      });
      // Long-lived token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'long-lived-token',
          token_type: 'bearer',
          expires_in: 5184000, // 60 days
        }),
      });

      const tokens = await ig.exchangeCodeForTokens('auth-code');
      expect(tokens.accessToken).toBe('long-lived-token');
      expect(tokens.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('getProfile', () => {
    it('should fetch Instagram profile via Facebook pages', async () => {
      // Step 1: Get Facebook pages to find Instagram business account
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'page-1', instagram_business_account: { id: 'ig-biz-123' } }],
        }),
      });
      // Step 2: Get Instagram profile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'ig-biz-123',
          name: 'Test IG',
          username: 'testig',
          profile_picture_url: 'https://ig.test/pic.jpg',
          followers_count: 10000,
        }),
      });

      const profile = await ig.getProfile('token');
      expect(profile.id).toBe('ig-biz-123');
      expect(profile.followerCount).toBe(10000);
    });
  });
});

// ── Facebook Adapter ──

describe('FacebookAdapter', () => {
  const fb = new FacebookAdapter();

  describe('getProfile', () => {
    it('should fetch Facebook profile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'fb-123',
          name: 'Test FB',
          picture: { data: { url: 'https://fb.test/pic.jpg' } },
        }),
      });

      const profile = await fb.getProfile('token');
      expect(profile.id).toBe('fb-123');
      expect(profile.name).toBe('Test FB');
    });
  });
});

// ── Cross-platform content validation ──

describe('Cross-platform content validation', () => {
  const platforms = ['twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads'] as const;

  it.each(platforms)('%s should accept empty-hashtags content within text limit', (platform) => {
    const adapter = getPlatformAdapter(platform);
    const content: PostContent = {
      text: 'Short valid post',
      media: [],
      hashtags: [],
    };
    expect(adapter.validateContent(content)).toEqual([]);
  });

  it.each(platforms)('%s should reject text over max limit', (platform) => {
    const adapter = getPlatformAdapter(platform);
    const content: PostContent = {
      text: 'x'.repeat(adapter.constraints.maxTextLength + 1),
      media: [],
      hashtags: [],
    };
    expect(adapter.validateContent(content).length).toBeGreaterThan(0);
  });
});
