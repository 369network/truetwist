import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getHashtagRecommendations,
  refreshHashtagMetrics,
  detectBannedHashtags,
  getRelatedHashtags,
} from '../hashtag-engine';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    hashtag: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    trendHashtag: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Private helper re-implementations for unit testing
// ---------------------------------------------------------------------------

function computeRelevance(
  tag: string,
  keywords: string[],
  reach: number,
  competition: string,
  direction: string
): number {
  let score = 0;
  if (keywords.includes(tag)) score += 0.4;
  score += Math.min(0.3, Math.log10(Math.max(reach, 1)) / 20);
  if (competition === 'low') score += 0.15;
  else if (competition === 'medium') score += 0.1;
  if (direction === 'rising') score += 0.15;
  return Math.min(1, score);
}

function computeCompetitionLevel(
  postCount: number,
  reach: number
): 'low' | 'medium' | 'high' | 'saturated' {
  const ratio = postCount > 0 ? reach / postCount : 0;
  if (postCount < 1000) return 'low';
  if (postCount < 50000 && ratio > 0.5) return 'medium';
  if (postCount < 500000) return 'high';
  return 'saturated';
}

function computeTrendDirection(
  avgVelocity: number,
  trends: Array<{ velocity: number; lifecycle: string }>
): 'rising' | 'stable' | 'declining' {
  const risingCount = trends.filter(
    (t) => t.lifecycle === 'emerging' || t.lifecycle === 'rising'
  ).length;
  const decliningCount = trends.filter(
    (t) => t.lifecycle === 'declining' || t.lifecycle === 'expired'
  ).length;
  if (risingCount > decliningCount && avgVelocity > 0) return 'rising';
  if (decliningCount > risingCount) return 'declining';
  return 'stable';
}

// ---------------------------------------------------------------------------
// Helper fixtures
// ---------------------------------------------------------------------------

function makeHashtag(overrides: Partial<{
  id: string;
  tag: string;
  platform: string;
  reach: number;
  postCount: number;
  competitionLevel: string;
  trendDirection: string;
  isBanned: boolean;
  category: string | null;
  relatedTags: string[];
  trendHashtags: unknown[];
}> = {}) {
  return {
    id: 'htag-1',
    tag: 'fitness',
    platform: 'instagram',
    reach: 50000,
    postCount: 10000,
    competitionLevel: 'medium',
    trendDirection: 'stable',
    isBanned: false,
    category: 'health',
    relatedTags: [],
    trendHashtags: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeRelevance
// ---------------------------------------------------------------------------

describe('computeRelevance (private helper)', () => {
  it('adds 0.4 when the tag is an exact keyword match', () => {
    const score = computeRelevance('fitness', ['fitness', 'gym'], 1, 'high', 'stable');
    // keyword match 0.4 + log10(1)/20=0 + 0 (high competition) + 0 (stable) = 0.4
    expect(score).toBeCloseTo(0.4, 5);
  });

  it('does not add keyword bonus when tag is not in keywords', () => {
    const score = computeRelevance('yoga', ['fitness', 'gym'], 1, 'high', 'stable');
    // no keyword, reach=1 => log10(1)/20 = 0
    expect(score).toBeCloseTo(0, 5);
  });

  it('adds reach score capped at 0.3 (log-scaled)', () => {
    // reach=10^6 => log10(1e6)/20 = 6/20 = 0.3 => min(0.3, 0.3) = 0.3
    const score = computeRelevance('x', [], 1_000_000, 'high', 'stable');
    expect(score).toBeCloseTo(0.3, 5);
  });

  it('reach score does not exceed 0.3 cap for very high reach', () => {
    const score = computeRelevance('x', [], 1e12, 'high', 'stable');
    expect(score).toBeCloseTo(0.3, 5);
  });

  it('reach=1 contributes log10(1)/20 = 0 to the score', () => {
    const score = computeRelevance('x', [], 1, 'low', 'stable');
    // low competition = 0.15
    expect(score).toBeCloseTo(0.15, 5);
  });

  it('adds 0.15 for low competition level', () => {
    const withLow = computeRelevance('x', [], 1, 'low', 'stable');
    const withHigh = computeRelevance('x', [], 1, 'high', 'stable');
    expect(withLow - withHigh).toBeCloseTo(0.15, 5);
  });

  it('adds 0.10 for medium competition level', () => {
    const withMedium = computeRelevance('x', [], 1, 'medium', 'stable');
    const withHigh = computeRelevance('x', [], 1, 'high', 'stable');
    expect(withMedium - withHigh).toBeCloseTo(0.1, 5);
  });

  it('adds 0.15 for rising trend direction', () => {
    const rising = computeRelevance('x', [], 1, 'high', 'rising');
    const stable = computeRelevance('x', [], 1, 'high', 'stable');
    expect(rising - stable).toBeCloseTo(0.15, 5);
  });

  it('returns maximum score of 1 even when all bonuses are stacked', () => {
    // keyword(0.4) + reach cap(0.3) + low(0.15) + rising(0.15) = 1.0
    const score = computeRelevance('fitness', ['fitness'], 1_000_000, 'low', 'rising');
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('clamps combined score at 1 and never exceeds it', () => {
    const score = computeRelevance('tag', ['tag'], 1e15, 'low', 'rising');
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// computeCompetitionLevel
// ---------------------------------------------------------------------------

describe('computeCompetitionLevel (private helper)', () => {
  it('returns "low" when postCount < 1000', () => {
    expect(computeCompetitionLevel(999, 5000)).toBe('low');
    expect(computeCompetitionLevel(0, 0)).toBe('low');
  });

  it('returns "medium" when postCount < 50000 and reach/postCount > 0.5', () => {
    // ratio = 30000 / 40000 = 0.75 > 0.5
    expect(computeCompetitionLevel(40000, 30000)).toBe('medium');
  });

  it('returns "high" instead of "medium" when ratio <= 0.5 for postCount in [1000, 50000)', () => {
    // ratio = 100 / 40000 = 0.0025, falls through to postCount < 500000 => 'high'
    expect(computeCompetitionLevel(40000, 100)).toBe('high');
  });

  it('returns "high" when postCount is in [50000, 500000)', () => {
    expect(computeCompetitionLevel(100000, 5000)).toBe('high');
    expect(computeCompetitionLevel(499999, 1)).toBe('high');
  });

  it('returns "saturated" when postCount >= 500000', () => {
    expect(computeCompetitionLevel(500000, 999999)).toBe('saturated');
    expect(computeCompetitionLevel(10_000_000, 1)).toBe('saturated');
  });

  it('handles postCount = 0 without dividing by zero (ratio defaults to 0)', () => {
    expect(computeCompetitionLevel(0, 1000)).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// computeTrendDirection
// ---------------------------------------------------------------------------

describe('computeTrendDirection (private helper)', () => {
  it('returns "rising" when more emerging/rising trends and avgVelocity > 0', () => {
    const trends = [
      { velocity: 10, lifecycle: 'emerging' },
      { velocity: 20, lifecycle: 'rising' },
      { velocity: 5, lifecycle: 'declining' },
    ];
    expect(computeTrendDirection(15, trends)).toBe('rising');
  });

  it('returns "declining" when more declining/expired trends regardless of velocity', () => {
    const trends = [
      { velocity: 50, lifecycle: 'rising' },
      { velocity: -10, lifecycle: 'declining' },
      { velocity: -20, lifecycle: 'expired' },
    ];
    expect(computeTrendDirection(-5, trends)).toBe('declining');
  });

  it('returns "stable" when risingCount equals decliningCount', () => {
    const trends = [
      { velocity: 10, lifecycle: 'rising' },
      { velocity: -5, lifecycle: 'declining' },
    ];
    expect(computeTrendDirection(5, trends)).toBe('stable');
  });

  it('returns "stable" when risingCount > decliningCount but avgVelocity <= 0', () => {
    const trends = [
      { velocity: 5, lifecycle: 'emerging' },
      { velocity: 5, lifecycle: 'rising' },
    ];
    // risingCount=2 > decliningCount=0, but avgVelocity=0 => not rising => stable
    expect(computeTrendDirection(0, trends)).toBe('stable');
  });

  it('returns "stable" for an empty trends array', () => {
    expect(computeTrendDirection(0, [])).toBe('stable');
  });

  it('counts "emerging" and "rising" as rising lifecycles', () => {
    const trends = [
      { velocity: 10, lifecycle: 'emerging' },
      { velocity: 10, lifecycle: 'rising' },
    ];
    expect(computeTrendDirection(10, trends)).toBe('rising');
  });

  it('counts "declining" and "expired" as declining lifecycles', () => {
    const trends = [
      { velocity: -5, lifecycle: 'declining' },
      { velocity: -10, lifecycle: 'expired' },
      { velocity: 3, lifecycle: 'rising' },
    ];
    expect(computeTrendDirection(-5, trends)).toBe('declining');
  });
});

// ---------------------------------------------------------------------------
// getHashtagRecommendations
// ---------------------------------------------------------------------------

describe('getHashtagRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns recommended, trending, niche, and banned fields', async () => {
    vi.mocked(prisma.hashtag.findMany)
      .mockResolvedValueOnce([makeHashtag({ tag: 'fitness', reach: 50000 })])   // related
      .mockResolvedValueOnce([makeHashtag({ tag: 'workout', trendDirection: 'rising' })]) // trending
      .mockResolvedValueOnce([]);                                                // banned

    const result = await getHashtagRecommendations('fitness tips', 'instagram');

    expect(result).toHaveProperty('recommended');
    expect(result).toHaveProperty('trending');
    expect(result).toHaveProperty('niche');
    expect(result).toHaveProperty('banned');
  });

  it('scores and sorts recommended hashtags by relevance descending', async () => {
    const highReach = makeHashtag({ id: 'h1', tag: 'fitness', reach: 1_000_000, competitionLevel: 'low', trendDirection: 'rising' });
    const lowReach = makeHashtag({ id: 'h2', tag: 'tips', reach: 10, competitionLevel: 'high', trendDirection: 'stable' });

    vi.mocked(prisma.hashtag.findMany)
      .mockResolvedValueOnce([lowReach, highReach]) // related — deliberately reversed
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getHashtagRecommendations('fitness tips', 'instagram');

    expect(result.recommended[0].tag).toBe('fitness');
    expect(result.recommended[0].relevanceScore).toBeGreaterThan(result.recommended[1].relevanceScore);
  });

  it('places trending hashtags with a fixed relevance score of 0.5', async () => {
    vi.mocked(prisma.hashtag.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeHashtag({ tag: 'trending1', trendDirection: 'rising' })])
      .mockResolvedValueOnce([]);

    const result = await getHashtagRecommendations('something', 'instagram');

    expect(result.trending).toHaveLength(1);
    expect(result.trending[0].relevanceScore).toBe(0.5);
  });

  it('filters niche to only low and medium competition hashtags', async () => {
    const low = makeHashtag({ id: 'h1', tag: 'niche1', competitionLevel: 'low' });
    const medium = makeHashtag({ id: 'h2', tag: 'niche2', competitionLevel: 'medium' });
    const high = makeHashtag({ id: 'h3', tag: 'popular', competitionLevel: 'high' });
    const saturated = makeHashtag({ id: 'h4', tag: 'mega', competitionLevel: 'saturated' });

    vi.mocked(prisma.hashtag.findMany)
      .mockResolvedValueOnce([low, medium, high, saturated])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getHashtagRecommendations('fitness', 'instagram');

    const nicheLevels = result.niche.map((h) => h.competitionLevel);
    expect(nicheLevels).not.toContain('high');
    expect(nicheLevels).not.toContain('saturated');
    nicheLevels.forEach((level) => expect(['low', 'medium']).toContain(level));
  });

  it('returns banned hashtag tags in the banned array', async () => {
    vi.mocked(prisma.hashtag.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ tag: 'spamtag' }, { tag: 'blockedtag' }]);

    const result = await getHashtagRecommendations('fitness spamtag', 'instagram');

    expect(result.banned).toContain('spamtag');
    expect(result.banned).toContain('blockedtag');
  });

  it('respects the limit parameter for recommended results', async () => {
    const hashtags = Array.from({ length: 20 }, (_, i) =>
      makeHashtag({ id: `h${i}`, tag: `tag${i}`, reach: 1000 })
    );

    vi.mocked(prisma.hashtag.findMany)
      .mockResolvedValueOnce(hashtags)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getHashtagRecommendations('fitness', 'instagram', 5);

    expect(result.recommended.length).toBeLessThanOrEqual(5);
  });

  it('returns empty arrays gracefully when no hashtags are found', async () => {
    vi.mocked(prisma.hashtag.findMany).mockResolvedValue([]);

    const result = await getHashtagRecommendations('obscuretopic', 'instagram');

    expect(result.recommended).toHaveLength(0);
    expect(result.trending).toHaveLength(0);
    expect(result.niche).toHaveLength(0);
    expect(result.banned).toHaveLength(0);
  });

  it('splits multi-word topic into keywords and filters out short words', async () => {
    // "to" (2 chars) should be filtered; "fitness" and "and" (3 chars) kept
    vi.mocked(prisma.hashtag.findMany).mockResolvedValue([]);

    await getHashtagRecommendations('to fitness and gym', 'instagram');

    // The first findMany call's `where.OR[0].tag.in` should not contain "to"
    const firstCall = vi.mocked(prisma.hashtag.findMany).mock.calls[0][0] as {
      where: { OR: Array<{ tag?: { in: string[] } }> };
    };
    const keywords = firstCall.where.OR[0].tag?.in ?? [];
    expect(keywords).not.toContain('to');
    expect(keywords).toContain('fitness');
  });
});

// ---------------------------------------------------------------------------
// refreshHashtagMetrics
// ---------------------------------------------------------------------------

describe('refreshHashtagMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the count of hashtags that were updated', async () => {
    const hashtagWithTrends = makeHashtag({
      id: 'htag-1',
      postCount: 5000,
      reach: 3000,
      trendHashtags: [
        { trend: { viralScore: 70, velocity: 5, lifecycle: 'rising' } },
        { trend: { viralScore: 50, velocity: 8, lifecycle: 'emerging' } },
      ],
    });

    vi.mocked(prisma.hashtag.findMany).mockResolvedValue([hashtagWithTrends] as any);
    vi.mocked(prisma.hashtag.update).mockResolvedValue(hashtagWithTrends as any);

    const count = await refreshHashtagMetrics('instagram');

    expect(count).toBe(1);
  });

  it('skips hashtags with no trend data and does not call update for them', async () => {
    const noTrends = makeHashtag({ id: 'htag-2', trendHashtags: [] });
    const withTrends = makeHashtag({
      id: 'htag-3',
      tag: 'gym',
      trendHashtags: [
        { trend: { viralScore: 60, velocity: 3, lifecycle: 'rising' } },
      ],
    });

    vi.mocked(prisma.hashtag.findMany).mockResolvedValue([noTrends, withTrends] as any);
    vi.mocked(prisma.hashtag.update).mockResolvedValue(withTrends as any);

    const count = await refreshHashtagMetrics('instagram');

    expect(count).toBe(1);
    expect(prisma.hashtag.update).toHaveBeenCalledTimes(1);
    expect(prisma.hashtag.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'htag-2' } })
    );
  });

  it('computes and persists correct competitionLevel and trendDirection', async () => {
    const hashtag = makeHashtag({
      id: 'htag-4',
      postCount: 800,   // < 1000 => 'low'
      reach: 500,
      trendHashtags: [
        { trend: { viralScore: 80, velocity: 10, lifecycle: 'emerging' } },
        { trend: { viralScore: 60, velocity: 5, lifecycle: 'rising' } },
      ],
    });

    vi.mocked(prisma.hashtag.findMany).mockResolvedValue([hashtag] as any);
    vi.mocked(prisma.hashtag.update).mockResolvedValue(hashtag as any);

    await refreshHashtagMetrics('instagram');

    expect(prisma.hashtag.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'htag-4' },
        data: expect.objectContaining({
          competitionLevel: 'low',
          trendDirection: 'rising',
        }),
      })
    );
  });

  it('sets lastUpdatedAt to a Date object during update', async () => {
    const hashtag = makeHashtag({
      id: 'htag-5',
      trendHashtags: [
        { trend: { viralScore: 55, velocity: 2, lifecycle: 'peaking' } },
      ],
    });

    vi.mocked(prisma.hashtag.findMany).mockResolvedValue([hashtag] as any);
    vi.mocked(prisma.hashtag.update).mockResolvedValue(hashtag as any);

    await refreshHashtagMetrics('instagram');

    const updateCall = vi.mocked(prisma.hashtag.update).mock.calls[0][0] as {
      data: { lastUpdatedAt: unknown };
    };
    expect(updateCall.data.lastUpdatedAt).toBeInstanceOf(Date);
  });

  it('returns 0 when no hashtags exist for the platform', async () => {
    vi.mocked(prisma.hashtag.findMany).mockResolvedValue([]);

    const count = await refreshHashtagMetrics('tiktok');

    expect(count).toBe(0);
    expect(prisma.hashtag.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// detectBannedHashtags
// ---------------------------------------------------------------------------

describe('detectBannedHashtags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the tags of flagged hashtags', async () => {
    const suspicious = [
      makeHashtag({ id: 'b1', tag: 'spamtag', postCount: 5000, reach: 50 }),
      makeHashtag({ id: 'b2', tag: 'ghosttag', postCount: 2000, reach: 10 }),
    ];

    vi.mocked(prisma.hashtag.findMany).mockResolvedValue(suspicious as any);
    vi.mocked(prisma.hashtag.update).mockResolvedValue({} as any);

    const flagged = await detectBannedHashtags('instagram');

    expect(flagged).toContain('spamtag');
    expect(flagged).toContain('ghosttag');
    expect(flagged).toHaveLength(2);
  });

  it('calls prisma update with isBanned: true for each suspicious hashtag', async () => {
    const suspicious = [makeHashtag({ id: 'b3', tag: 'banned1' })];

    vi.mocked(prisma.hashtag.findMany).mockResolvedValue(suspicious as any);
    vi.mocked(prisma.hashtag.update).mockResolvedValue({} as any);

    await detectBannedHashtags('instagram');

    expect(prisma.hashtag.update).toHaveBeenCalledWith({
      where: { id: 'b3' },
      data: { isBanned: true },
    });
  });

  it('returns an empty array when no suspicious hashtags are found', async () => {
    vi.mocked(prisma.hashtag.findMany).mockResolvedValue([]);

    const flagged = await detectBannedHashtags('twitter');

    expect(flagged).toHaveLength(0);
    expect(prisma.hashtag.update).not.toHaveBeenCalled();
  });

  it('queries only non-banned hashtags with postCount > 1000 and reach < 100', async () => {
    vi.mocked(prisma.hashtag.findMany).mockResolvedValue([]);

    await detectBannedHashtags('tiktok');

    expect(prisma.hashtag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: 'tiktok',
          isBanned: false,
          postCount: { gt: 1000 },
          reach: { lt: 100 },
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// getRelatedHashtags
// ---------------------------------------------------------------------------

describe('getRelatedHashtags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty array when the hashtag does not exist', async () => {
    vi.mocked(prisma.hashtag.findUnique).mockResolvedValue(null);

    const result = await getRelatedHashtags('unknowntag', 'instagram');

    expect(result).toEqual([]);
    expect(prisma.trendHashtag.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty array when the hashtag has no trendHashtags', async () => {
    vi.mocked(prisma.hashtag.findUnique).mockResolvedValue(
      makeHashtag({ id: 'h1', trendHashtags: [] }) as any
    );

    const result = await getRelatedHashtags('fitness', 'instagram');

    expect(result).toEqual([]);
    expect(prisma.trendHashtag.findMany).not.toHaveBeenCalled();
  });

  it('returns related hashtags shaped as HashtagRecommendation objects', async () => {
    vi.mocked(prisma.hashtag.findUnique).mockResolvedValue(
      makeHashtag({
        id: 'h1',
        tag: 'fitness',
        trendHashtags: [{ trendId: 'trend-1' }, { trendId: 'trend-2' }],
      }) as any
    );

    vi.mocked(prisma.trendHashtag.findMany).mockResolvedValue([
      {
        relevance: 0.8,
        hashtag: makeHashtag({ id: 'h2', tag: 'gym', platform: 'instagram', reach: 20000, competitionLevel: 'medium', trendDirection: 'rising', isBanned: false }),
      },
    ] as any);

    const result = await getRelatedHashtags('fitness', 'instagram');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tag: 'gym',
      platform: 'instagram',
      reach: 20000,
      competitionLevel: 'medium',
      trendDirection: 'rising',
      relevanceScore: 0.8,
      isBanned: false,
    });
  });

  it('queries trendHashtag with the correct trendIds and excludes the source hashtag id', async () => {
    vi.mocked(prisma.hashtag.findUnique).mockResolvedValue(
      makeHashtag({
        id: 'source-id',
        trendHashtags: [{ trendId: 'trend-A' }, { trendId: 'trend-B' }],
      }) as any
    );
    vi.mocked(prisma.trendHashtag.findMany).mockResolvedValue([]);

    await getRelatedHashtags('fitness', 'instagram', 5);

    expect(prisma.trendHashtag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          trendId: { in: ['trend-A', 'trend-B'] },
          hashtagId: { not: 'source-id' },
        },
        take: 5,
      })
    );
  });

  it('uses the compound unique key tag_platform when looking up the hashtag', async () => {
    vi.mocked(prisma.hashtag.findUnique).mockResolvedValue(null);

    await getRelatedHashtags('wellness', 'tiktok');

    expect(prisma.hashtag.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tag_platform: { tag: 'wellness', platform: 'tiktok' } },
      })
    );
  });
});
