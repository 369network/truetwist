import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAdCreative } from '../ad-creative-service';
import type { BrandContext, AdCreativeRequest } from '../types';

vi.mock('../openai-client', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

import { openai } from '../openai-client';

const mockBrand: BrandContext = {
  businessName: 'TestBiz',
  industry: 'E-commerce',
  description: 'Online store selling tech accessories',
  brandVoice: 'Bold and direct',
  targetAudience: { age: '18-35', interests: ['tech', 'gadgets'] },
};

describe('Ad Creative Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateAdCreative — Meta', () => {
    const metaRequest: AdCreativeRequest = {
      userId: 'user-123',
      businessId: 'biz-456',
      platform: 'meta',
      objective: 'conversions',
      productOrService: 'Wireless charging pad',
      targetAudience: 'Tech-savvy millennials',
      variantCount: 3,
    };

    it('should generate Meta ad creative variants with scores', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variants: [
                  {
                    creative: {
                      primaryText: 'Cut the cord. Charge faster.',
                      headline: 'Wireless Charging Redefined',
                      description: 'Ships free. Shop now.',
                      cta: 'Shop Now',
                    },
                    scores: { novelty: 0.8, clarity: 0.9, ctaStrength: 0.85, overall: 0.85 },
                    recommendation: 'Strong for conversion campaigns — clear value prop',
                  },
                  {
                    creative: {
                      primaryText: 'Your desk deserves better.',
                      headline: 'Premium Wireless Charger',
                      description: 'Sleek. Fast. Yours.',
                      cta: 'Learn More',
                    },
                    scores: { novelty: 0.7, clarity: 0.8, ctaStrength: 0.6, overall: 0.7 },
                    recommendation: 'Good for awareness — aspirational angle',
                  },
                  {
                    creative: {
                      primaryText: '50,000+ happy customers agree.',
                      headline: 'Charge Without Wires',
                      description: 'Join the movement.',
                      cta: 'Shop Now',
                    },
                    scores: { novelty: 0.6, clarity: 0.85, ctaStrength: 0.9, overall: 0.78 },
                    recommendation: 'Social proof hook — test against variant 1',
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 600, completion_tokens: 400 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      const result = await generateAdCreative(metaRequest, mockBrand);

      expect(result.variants).toHaveLength(3);
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.costCents).toBeGreaterThan(0);

      const first = result.variants[0];
      expect(first.platform).toBe('meta');
      expect(first.scores.overall).toBeGreaterThan(0);
      expect(first.recommendation).toBeTruthy();

      // Verify Meta creative shape
      const creative = first.creative as { primaryText: string; headline: string; description: string; cta: string };
      expect(creative.primaryText).toBeTruthy();
      expect(creative.headline).toBeTruthy();
      expect(creative.cta).toBeTruthy();
    });
  });

  describe('generateAdCreative — Google RSA', () => {
    const googleRequest: AdCreativeRequest = {
      userId: 'user-123',
      businessId: 'biz-456',
      platform: 'google',
      objective: 'traffic',
      productOrService: 'Project management SaaS',
      variantCount: 2,
    };

    it('should generate Google RSA variants with headlines and descriptions', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variants: [
                  {
                    creative: {
                      headlines: [
                        'Manage Projects Faster',
                        'Free 14-Day Trial',
                        'Team Collaboration Tool',
                      ],
                      descriptions: [
                        'Streamline your workflow with our intuitive project management platform.',
                        'Join 10,000+ teams already shipping faster with TestBiz.',
                      ],
                    },
                    scores: { novelty: 0.7, clarity: 0.9, ctaStrength: 0.8, overall: 0.8 },
                    recommendation: 'Good baseline for search campaigns',
                  },
                  {
                    creative: {
                      headlines: [
                        'Ship Projects On Time',
                        'No Credit Card Needed',
                        'Built for Remote Teams',
                      ],
                      descriptions: [
                        'Stop missing deadlines. TestBiz keeps your team aligned and on track.',
                        'The project tool your team will actually want to use. Try it free.',
                      ],
                    },
                    scores: { novelty: 0.8, clarity: 0.85, ctaStrength: 0.75, overall: 0.8 },
                    recommendation: 'Pain-point driven — test for higher-intent queries',
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 500, completion_tokens: 350 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      const result = await generateAdCreative(googleRequest, mockBrand);

      expect(result.variants).toHaveLength(2);

      const creative = result.variants[0].creative as { headlines: string[]; descriptions: string[] };
      expect(creative.headlines.length).toBeGreaterThan(0);
      expect(creative.descriptions.length).toBeGreaterThan(0);
    });
  });

  describe('generateAdCreative — TikTok', () => {
    const tiktokRequest: AdCreativeRequest = {
      userId: 'user-123',
      businessId: 'biz-456',
      platform: 'tiktok',
      objective: 'awareness',
      productOrService: 'Fitness tracking app',
      variantCount: 2,
    };

    it('should generate TikTok ad variants with overlay and caption', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variants: [
                  {
                    creative: {
                      overlayText: 'Track every rep 💪',
                      caption: 'Your fitness journey starts with a single tap. Download TestBiz today.',
                      cta: 'Download',
                    },
                    scores: { novelty: 0.75, clarity: 0.9, ctaStrength: 0.8, overall: 0.82 },
                    recommendation: 'Strong for awareness with clear CTA',
                  },
                  {
                    creative: {
                      overlayText: 'POV: you finally track it all',
                      caption: 'No more guessing. TestBiz tracks workouts, meals, and progress in one place.',
                      cta: 'Learn More',
                    },
                    scores: { novelty: 0.85, clarity: 0.8, ctaStrength: 0.65, overall: 0.77 },
                    recommendation: 'Native TikTok style — good for organic feel',
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 500, completion_tokens: 300 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      const result = await generateAdCreative(tiktokRequest, mockBrand);

      expect(result.variants).toHaveLength(2);
      const creative = result.variants[0].creative as { overlayText: string; caption: string; cta: string };
      expect(creative.overlayText).toBeTruthy();
      expect(creative.caption).toBeTruthy();
      expect(creative.cta).toBeTruthy();
    });
  });

  it('should use temperature 0.7 for creative work', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({ variants: [] }),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };

    vi.mocked(openai.chat.completions.create).mockResolvedValue(
      mockResponse as any
    );

    await generateAdCreative(
      {
        userId: 'user-123',
        businessId: 'biz-456',
        platform: 'meta',
        objective: 'conversions',
        productOrService: 'Test product',
      },
      mockBrand
    );

    expect(openai.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.7,
        response_format: { type: 'json_object' },
      })
    );
  });

  it('should throw when no content is returned', async () => {
    const mockResponse = {
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 100, completion_tokens: 0 },
    };

    vi.mocked(openai.chat.completions.create).mockResolvedValue(
      mockResponse as any
    );

    await expect(
      generateAdCreative(
        {
          userId: 'user-123',
          businessId: 'biz-456',
          platform: 'meta',
          objective: 'conversions',
          productOrService: 'Test',
        },
        mockBrand
      )
    ).rejects.toThrow('No content returned from ad creative generation');
  });
});
