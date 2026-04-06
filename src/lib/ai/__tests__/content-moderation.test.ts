import { describe, it, expect, vi, beforeEach } from 'vitest';
import { moderateContent } from '../content-moderation';

vi.mock('../openai-client', () => ({
  openai: {
    moderations: {
      create: vi.fn(),
    },
  },
}));

import { openai } from '../openai-client';

describe('Content Moderation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return not flagged for safe content', async () => {
    vi.mocked(openai.moderations.create).mockResolvedValue({
      results: [
        {
          flagged: false,
          categories: {
            hate: false,
            'hate/threatening': false,
            'self-harm': false,
            sexual: false,
            'sexual/minors': false,
            violence: false,
            'violence/graphic': false,
          },
        },
      ],
    } as any);

    const result = await moderateContent('Check out our new product!');

    expect(result.flagged).toBe(false);
    expect(result.categories).toEqual([]);
    expect(result.message).toBeUndefined();
  });

  it('should return flagged categories for unsafe content', async () => {
    vi.mocked(openai.moderations.create).mockResolvedValue({
      results: [
        {
          flagged: true,
          categories: {
            hate: true,
            'hate/threatening': false,
            'self-harm': false,
            sexual: false,
            'sexual/minors': false,
            violence: true,
            'violence/graphic': false,
          },
        },
      ],
    } as any);

    const result = await moderateContent('some flagged content');

    expect(result.flagged).toBe(true);
    expect(result.categories).toContain('hate');
    expect(result.categories).toContain('violence');
    expect(result.message).toContain('hate');
    expect(result.message).toContain('violence');
  });

  it('should handle empty results gracefully', async () => {
    vi.mocked(openai.moderations.create).mockResolvedValue({
      results: [],
    } as any);

    const result = await moderateContent('test');

    expect(result.flagged).toBe(false);
    expect(result.categories).toEqual([]);
  });
});
