import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService, type AnalyticsServiceConfig, type AnalyticsJobData } from '../analytics-service';
import type { PostAnalytics, Platform } from '../types';

// ---------- mocks ----------

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({}),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  Job: vi.fn(),
}));

vi.mock('../platforms', () => ({
  getPlatformAdapter: vi.fn().mockReturnValue({
    fetchAnalytics: vi.fn(),
  }),
  isPlatformSupported: vi.fn().mockReturnValue(true),
}));

vi.mock('../oauth2-manager', () => ({
  oauth2Manager: {
    needsRefresh: vi.fn().mockReturnValue(false),
    refreshTokens: vi.fn(),
    decryptAccessToken: vi.fn().mockReturnValue('token'),
  },
}));

// ---------- helpers ----------

import { isPlatformSupported } from '../platforms';
import { Queue } from 'bullmq';

function makeAnalytics(overrides: Partial<PostAnalytics> = {}): PostAnalytics {
  return {
    impressions: 1000,
    reach: 800,
    likes: 100,
    comments: 20,
    shares: 30,
    saves: 10,
    clicks: 40,
    engagementRate: 0,
    fetchedAt: new Date(),
    ...overrides,
  };
}

function makePost(platform: Platform = 'twitter'): AnalyticsJobData {
  return {
    postPlatformId: `post-${platform}-1`,
    socialAccountId: `account-${platform}-1`,
    platform,
    platformPostId: `platform-post-${platform}-1`,
  };
}

function makeConfig(overrides: Partial<AnalyticsServiceConfig> = {}): AnalyticsServiceConfig {
  return {
    redis: {} as any,
    getEncryptedToken: vi.fn().mockResolvedValue({
      encryptedAccessToken: 'encrypted:token',
      encryptedRefreshToken: null,
      expiresAt: null,
      platform: 'twitter',
    }),
    onAnalyticsFetched: vi.fn().mockResolvedValue(undefined),
    getPublishedPosts: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ---------- tests ----------

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- calculateEngagementRate ----

  describe('calculateEngagementRate (static)', () => {
    it('returns 0 when impressions is zero (avoids division by zero)', () => {
      const analytics = makeAnalytics({ impressions: 0 });
      expect(AnalyticsService.calculateEngagementRate(analytics)).toBe(0);
    });

    it('correctly computes (likes + comments + shares + saves + clicks) / impressions', () => {
      // 100 + 20 + 30 + 10 + 40 = 200 engagements; 200 / 1000 = 0.2
      const analytics = makeAnalytics({
        impressions: 1000,
        likes: 100,
        comments: 20,
        shares: 30,
        saves: 10,
        clicks: 40,
      });
      expect(AnalyticsService.calculateEngagementRate(analytics)).toBeCloseTo(0.2);
    });

    it('returns 0 when all engagement metrics are zero', () => {
      const analytics = makeAnalytics({
        impressions: 500,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        clicks: 0,
      });
      expect(AnalyticsService.calculateEngagementRate(analytics)).toBe(0);
    });
  });

  // ---- triggerCollection ----

  describe('triggerCollection', () => {
    it('queues a job for every supported post and returns the count', async () => {
      const posts = [makePost('twitter'), makePost('instagram'), makePost('linkedin')];
      const config = makeConfig({
        getPublishedPosts: vi.fn().mockResolvedValue(posts),
      });
      const service = new AnalyticsService(config);

      const count = await service.triggerCollection();

      expect(count).toBe(3);
      // Retrieve the mocked Queue instance and check that add was called 3 times
      const queueInstance = (Queue as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(queueInstance.add).toHaveBeenCalledTimes(3);
    });

    it('skips posts on unsupported platforms and does not queue them', async () => {
      const posts = [makePost('twitter'), makePost('instagram')];
      (isPlatformSupported as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(true)   // twitter → supported
        .mockReturnValueOnce(false); // instagram → unsupported

      const config = makeConfig({
        getPublishedPosts: vi.fn().mockResolvedValue(posts),
      });
      const service = new AnalyticsService(config);

      const count = await service.triggerCollection();

      expect(count).toBe(1);
      const queueInstance = (Queue as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(queueInstance.add).toHaveBeenCalledTimes(1);
    });
  });

  // ---- shutdown ----

  describe('shutdown', () => {
    it('closes the queue on shutdown', async () => {
      const service = new AnalyticsService(makeConfig());
      await service.shutdown();

      const queueInstance = (Queue as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(queueInstance.close).toHaveBeenCalled();
    });

    it('does not throw when shutdown is called before start (worker never created)', async () => {
      const service = new AnalyticsService(makeConfig());
      await expect(service.shutdown()).resolves.not.toThrow();
    });
  });
});
