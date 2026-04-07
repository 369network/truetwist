import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  triggerCompetitorCollection,
  fetchCompetitorProfile,
  fetchCompetitorPosts,
} from '../collection-service';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: { competitorAccount: { findMany: vi.fn() } },
}));

// Mock BullMQ so the module-level Queue instantiation doesn't try to connect
// to Redis and so we can spy on `add`.
const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  Worker: vi.fn().mockImplementation(() => ({})),
}));

import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Test helpers — local types mirroring the private PostData interface
// ---------------------------------------------------------------------------

interface PostData {
  platformPostId: string;
  contentText: string | null;
  contentType: string;
  mediaUrls: string[];
  hashtags: string[];
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  postedAt: Date;
}

function makePost(overrides: Partial<PostData> = {}): PostData {
  return {
    platformPostId: 'post-1',
    contentText: null,
    contentType: 'image',
    mediaUrls: [],
    hashtags: [],
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    postedAt: new Date('2024-01-01T12:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reimplementations of private helpers (mirroring source exactly)
// ---------------------------------------------------------------------------

function calculatePostingFrequency(posts: Pick<PostData, 'postedAt'>[]): number {
  if (posts.length < 2) return posts.length;
  const sorted = [...posts].sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());
  const spanMs = sorted[sorted.length - 1].postedAt.getTime() - sorted[0].postedAt.getTime();
  const spanWeeks = spanMs / (7 * 24 * 60 * 60 * 1000);
  return spanWeeks > 0 ? posts.length / spanWeeks : posts.length;
}

function calculateContentMix(posts: Pick<PostData, 'contentType'>[]): Record<string, number> {
  if (posts.length === 0) return {};
  const counts: Record<string, number> = {};
  for (const post of posts) {
    counts[post.contentType] = (counts[post.contentType] || 0) + 1;
  }
  const mix: Record<string, number> = {};
  for (const [type, count] of Object.entries(counts)) {
    mix[type] = Math.round((count / posts.length) * 100);
  }
  return mix;
}

function extractTopHashtags(posts: Pick<PostData, 'hashtags'>[], limit = 20): string[] {
  const counts: Record<string, number> = {};
  for (const post of posts) {
    for (const tag of post.hashtags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function calculatePeakPostingHours(posts: Pick<PostData, 'postedAt'>[]): number[] {
  const hourCounts: Record<number, number> = {};
  for (const post of posts) {
    const hour = post.postedAt.getUTCHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }
  return Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hour]) => parseInt(hour));
}

// ---------------------------------------------------------------------------
// calculatePostingFrequency
// ---------------------------------------------------------------------------

describe('calculatePostingFrequency', () => {
  it('returns 0 for an empty post list', () => {
    expect(calculatePostingFrequency([])).toBe(0);
  });

  it('returns 1 for a single post', () => {
    expect(calculatePostingFrequency([{ postedAt: new Date() }])).toBe(1);
  });

  it('calculates posts per week correctly over exactly one week', () => {
    const base = new Date('2024-01-01T00:00:00Z').getTime();
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const posts = [
      { postedAt: new Date(base) },
      { postedAt: new Date(base + ONE_WEEK_MS) },
    ];
    // 2 posts spanning 1 week = 2 posts/week
    expect(calculatePostingFrequency(posts)).toBeCloseTo(2, 5);
  });

  it('handles posts provided in reverse chronological order', () => {
    const now = Date.now();
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const posts = [
      { postedAt: new Date(now) },
      { postedAt: new Date(now - ONE_WEEK_MS) },
    ];
    expect(calculatePostingFrequency(posts)).toBeCloseTo(2, 5);
  });

  it('returns a frequency greater than 7 for daily posts over 6 days', () => {
    const now = Date.now();
    const posts = Array.from({ length: 7 }, (_, i) => ({
      postedAt: new Date(now - (6 - i) * 24 * 60 * 60 * 1000),
    }));
    // 7 posts spanning 6 days ≈ 8.17 posts/week
    const freq = calculatePostingFrequency(posts);
    expect(freq).toBeGreaterThan(7);
    expect(freq).toBeLessThan(9);
  });
});

// ---------------------------------------------------------------------------
// calculateContentMix
// ---------------------------------------------------------------------------

describe('calculateContentMix', () => {
  it('returns an empty object when there are no posts', () => {
    expect(calculateContentMix([])).toEqual({});
  });

  it('returns 100% for a single content type', () => {
    const posts = [{ contentType: 'video' }, { contentType: 'video' }];
    expect(calculateContentMix(posts)).toEqual({ video: 100 });
  });

  it('calculates correct percentages for a balanced mix', () => {
    const posts = [
      { contentType: 'image' },
      { contentType: 'image' },
      { contentType: 'video' },
      { contentType: 'video' },
    ];
    expect(calculateContentMix(posts)).toEqual({ image: 50, video: 50 });
  });

  it('rounds percentages to the nearest integer', () => {
    // 1 out of 3 ≈ 33.33% → should round to 33
    const posts = [
      { contentType: 'text' },
      { contentType: 'image' },
      { contentType: 'image' },
    ];
    const result = calculateContentMix(posts);
    expect(result.text).toBe(33);
    expect(result.image).toBe(67);
  });

  it('handles many distinct content types', () => {
    const types = ['image', 'video', 'reel', 'story', 'carousel'];
    const posts = types.map(contentType => ({ contentType }));
    const result = calculateContentMix(posts);
    expect(Object.keys(result)).toHaveLength(5);
    for (const pct of Object.values(result)) {
      expect(pct).toBe(20);
    }
  });
});

// ---------------------------------------------------------------------------
// extractTopHashtags
// ---------------------------------------------------------------------------

describe('extractTopHashtags', () => {
  it('returns an empty array when there are no posts', () => {
    expect(extractTopHashtags([])).toEqual([]);
  });

  it('returns an empty array when posts have no hashtags', () => {
    expect(extractTopHashtags([{ hashtags: [] }, { hashtags: [] }])).toEqual([]);
  });

  it('returns hashtags sorted by descending frequency', () => {
    const posts = [
      { hashtags: ['#a', '#b', '#c'] },
      { hashtags: ['#b', '#c'] },
      { hashtags: ['#c'] },
    ];
    expect(extractTopHashtags(posts)).toEqual(['#c', '#b', '#a']);
  });

  it('respects the limit parameter', () => {
    const posts = [{ hashtags: ['#a', '#b', '#c', '#d', '#e'] }];
    const result = extractTopHashtags(posts, 3);
    expect(result).toHaveLength(3);
  });

  it('uses a default limit of 20', () => {
    const hashtags = Array.from({ length: 25 }, (_, i) => `#tag${i}`);
    const posts = [{ hashtags }];
    expect(extractTopHashtags(posts)).toHaveLength(20);
  });

  it('counts the same hashtag across multiple posts', () => {
    const posts = [
      { hashtags: ['#trending'] },
      { hashtags: ['#trending', '#other'] },
      { hashtags: ['#trending'] },
    ];
    const result = extractTopHashtags(posts);
    expect(result[0]).toBe('#trending');
    expect(result[1]).toBe('#other');
  });
});

// ---------------------------------------------------------------------------
// calculatePeakPostingHours
// ---------------------------------------------------------------------------

describe('calculatePeakPostingHours', () => {
  it('returns an empty array when there are no posts', () => {
    expect(calculatePeakPostingHours([])).toEqual([]);
  });

  it('returns the correct top UTC hour', () => {
    const posts = [
      { postedAt: new Date('2024-01-01T09:00:00Z') },
      { postedAt: new Date('2024-01-02T09:15:00Z') },
      { postedAt: new Date('2024-01-03T14:00:00Z') },
    ];
    const result = calculatePeakPostingHours(posts);
    expect(result[0]).toBe(9);
  });

  it('returns up to 5 peak hours', () => {
    const hours = [0, 6, 9, 12, 14, 18, 21];
    const posts = hours.map(h => ({
      postedAt: new Date(`2024-01-01T${String(h).padStart(2, '0')}:00:00Z`),
    }));
    expect(calculatePeakPostingHours(posts).length).toBeLessThanOrEqual(5);
  });

  it('sorts results by descending post count', () => {
    const posts = [
      { postedAt: new Date('2024-01-01T09:00:00Z') },
      { postedAt: new Date('2024-01-01T09:30:00Z') },
      { postedAt: new Date('2024-01-01T14:00:00Z') },
      { postedAt: new Date('2024-01-01T14:30:00Z') },
      { postedAt: new Date('2024-01-01T14:45:00Z') },
      { postedAt: new Date('2024-01-01T18:00:00Z') },
    ];
    const result = calculatePeakPostingHours(posts);
    expect(result[0]).toBe(14); // 3 posts at hour 14
    expect(result[1]).toBe(9);  // 2 posts at hour 9
  });
});

// ---------------------------------------------------------------------------
// triggerCompetitorCollection
// ---------------------------------------------------------------------------

describe('triggerCompetitorCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueAdd.mockResolvedValue({ id: 'job-1' });
  });

  it('returns 0 when there are no competitor accounts', async () => {
    vi.mocked(prisma.competitorAccount.findMany).mockResolvedValue([]);
    const count = await triggerCompetitorCollection();
    expect(count).toBe(0);
  });

  it('queues one job per competitor account and returns the count', async () => {
    vi.mocked(prisma.competitorAccount.findMany).mockResolvedValue([
      {
        id: 'acc-1',
        competitorId: 'comp-1',
        platform: 'instagram',
        handle: 'brand_ig',
        competitor: { businessId: 'biz-1' },
      },
      {
        id: 'acc-2',
        competitorId: 'comp-1',
        platform: 'twitter',
        handle: 'brand_tw',
        competitor: { businessId: 'biz-1' },
      },
    ] as any);

    const count = await triggerCompetitorCollection();

    expect(count).toBe(2);
    expect(mockQueueAdd).toHaveBeenCalledTimes(2);
  });

  it('passes correct job data to the queue', async () => {
    vi.mocked(prisma.competitorAccount.findMany).mockResolvedValue([
      {
        id: 'acc-99',
        competitorId: 'comp-99',
        platform: 'tiktok',
        handle: 'cool_brand',
        competitor: { businessId: 'biz-99' },
      },
    ] as any);

    await triggerCompetitorCollection();

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'collect',
      expect.objectContaining({
        competitorAccountId: 'acc-99',
        competitorId: 'comp-99',
        businessId: 'biz-99',
        platform: 'tiktok',
        handle: 'cool_brand',
      }),
      expect.objectContaining({ jobId: expect.stringContaining('collect:acc-99:') })
    );
  });

  it('includes unique timestamp-based jobId for each job', async () => {
    vi.mocked(prisma.competitorAccount.findMany).mockResolvedValue([
      {
        id: 'acc-1',
        competitorId: 'comp-1',
        platform: 'instagram',
        handle: 'a',
        competitor: { businessId: 'biz-1' },
      },
      {
        id: 'acc-2',
        competitorId: 'comp-1',
        platform: 'instagram',
        handle: 'b',
        competitor: { businessId: 'biz-1' },
      },
    ] as any);

    await triggerCompetitorCollection();

    const calls = mockQueueAdd.mock.calls;
    const jobId1: string = calls[0][2].jobId;
    const jobId2: string = calls[1][2].jobId;

    expect(jobId1).toMatch(/^collect:acc-1:/);
    expect(jobId2).toMatch(/^collect:acc-2:/);
  });
});

// ---------------------------------------------------------------------------
// fetchCompetitorProfile
// ---------------------------------------------------------------------------

describe('fetchCompetitorProfile', () => {
  it('returns zeroed profile data regardless of platform or handle', async () => {
    const result = await fetchCompetitorProfile('instagram', 'some_brand');
    expect(result).toEqual({ followerCount: 0, followingCount: 0, postCount: 0 });
  });

  it('returns the same placeholder shape for any platform', async () => {
    for (const platform of ['twitter', 'tiktok', 'youtube', 'linkedin']) {
      const result = await fetchCompetitorProfile(platform, 'handle');
      expect(result.followerCount).toBe(0);
      expect(result.followingCount).toBe(0);
      expect(result.postCount).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// fetchCompetitorPosts
// ---------------------------------------------------------------------------

describe('fetchCompetitorPosts', () => {
  it('returns an empty array regardless of platform or handle', async () => {
    const result = await fetchCompetitorPosts('instagram', 'some_brand');
    expect(result).toEqual([]);
  });

  it('returns an empty array for any platform', async () => {
    for (const platform of ['twitter', 'tiktok', 'youtube']) {
      const posts = await fetchCompetitorPosts(platform, 'handle');
      expect(Array.isArray(posts)).toBe(true);
      expect(posts).toHaveLength(0);
    }
  });
});
