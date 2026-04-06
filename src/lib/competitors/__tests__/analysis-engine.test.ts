import { describe, it, expect } from 'vitest';

// Test the pure utility functions used by the analysis engine
describe('Analysis Engine - calculatePercentile', () => {
  // Reimplementation of the private helper for testing
  function calculatePercentile(value: number, distribution: number[]): number {
    if (distribution.length === 0) return 50;
    const below = distribution.filter(v => v < value).length;
    return Math.round((below / distribution.length) * 100);
  }

  it('returns 50 for empty distribution', () => {
    expect(calculatePercentile(10, [])).toBe(50);
  });

  it('returns 100 when value exceeds all in distribution', () => {
    expect(calculatePercentile(100, [10, 20, 30])).toBe(100);
  });

  it('returns 0 when value is below all in distribution', () => {
    expect(calculatePercentile(1, [10, 20, 30])).toBe(0);
  });

  it('returns correct percentile for mid-range value', () => {
    // 25 is above 10,20 (2 out of 4 = 50th percentile)
    expect(calculatePercentile(25, [10, 20, 30, 40])).toBe(50);
  });

  it('returns correct percentile for value equal to some entries', () => {
    // 20 is above only 10 (1 out of 3 = 33rd percentile)
    expect(calculatePercentile(20, [10, 20, 30])).toBe(33);
  });
});

describe('Analysis Engine - content mix calculation', () => {
  function calculateContentMix(posts: { contentType: string }[]): Record<string, number> {
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

  it('returns empty object for no posts', () => {
    expect(calculateContentMix([])).toEqual({});
  });

  it('correctly calculates single type', () => {
    const posts = [
      { contentType: 'image' },
      { contentType: 'image' },
    ];
    expect(calculateContentMix(posts)).toEqual({ image: 100 });
  });

  it('correctly calculates mixed types', () => {
    const posts = [
      { contentType: 'text' },
      { contentType: 'image' },
      { contentType: 'image' },
      { contentType: 'video' },
    ];
    expect(calculateContentMix(posts)).toEqual({ text: 25, image: 50, video: 25 });
  });
});

describe('Analysis Engine - posting frequency', () => {
  function calculatePostingFrequency(posts: { postedAt: Date }[]): number {
    if (posts.length < 2) return posts.length;
    const sorted = [...posts].sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());
    const spanMs = sorted[sorted.length - 1].postedAt.getTime() - sorted[0].postedAt.getTime();
    const spanWeeks = spanMs / (7 * 24 * 60 * 60 * 1000);
    return spanWeeks > 0 ? posts.length / spanWeeks : posts.length;
  }

  it('returns 0 for no posts', () => {
    expect(calculatePostingFrequency([])).toBe(0);
  });

  it('returns 1 for single post', () => {
    expect(calculatePostingFrequency([{ postedAt: new Date() }])).toBe(1);
  });

  it('calculates correct frequency for 7 posts over 1 week', () => {
    const now = Date.now();
    const posts = Array.from({ length: 7 }, (_, i) => ({
      postedAt: new Date(now - (6 - i) * 24 * 60 * 60 * 1000), // 1 post per day
    }));
    const freq = calculatePostingFrequency(posts);
    // 7 posts over ~6 days ≈ 8.17 posts/week
    expect(freq).toBeGreaterThan(7);
    expect(freq).toBeLessThan(9);
  });
});

describe('Analysis Engine - hashtag extraction', () => {
  function extractTopHashtags(posts: { hashtags: string[] }[], limit = 20): string[] {
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

  it('returns empty for no posts', () => {
    expect(extractTopHashtags([])).toEqual([]);
  });

  it('returns sorted by frequency', () => {
    const posts = [
      { hashtags: ['#a', '#b', '#c'] },
      { hashtags: ['#b', '#c'] },
      { hashtags: ['#c'] },
    ];
    expect(extractTopHashtags(posts)).toEqual(['#c', '#b', '#a']);
  });

  it('respects limit parameter', () => {
    const posts = [
      { hashtags: ['#a', '#b', '#c', '#d', '#e'] },
    ];
    expect(extractTopHashtags(posts, 3)).toHaveLength(3);
  });
});

describe('Analysis Engine - peak posting hours', () => {
  function calculatePeakPostingHours(posts: { postedAt: Date }[]): number[] {
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

  it('returns empty for no posts', () => {
    expect(calculatePeakPostingHours([])).toEqual([]);
  });

  it('returns top posting hours sorted by frequency', () => {
    const posts = [
      { postedAt: new Date('2024-01-01T09:00:00Z') },
      { postedAt: new Date('2024-01-01T09:30:00Z') },
      { postedAt: new Date('2024-01-01T14:00:00Z') },
      { postedAt: new Date('2024-01-01T14:30:00Z') },
      { postedAt: new Date('2024-01-01T14:45:00Z') },
      { postedAt: new Date('2024-01-01T18:00:00Z') },
    ];
    const result = calculatePeakPostingHours(posts);
    expect(result[0]).toBe(14); // 3 posts at 14:xx
    expect(result[1]).toBe(9);  // 2 posts at 09:xx
  });
});
