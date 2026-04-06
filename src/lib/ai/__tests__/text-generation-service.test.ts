import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText, generateHashtags } from '../text-generation-service';
import type { BrandContext, TextGenerationRequest } from '../types';

// Mock OpenAI
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
  industry: 'Technology',
  description: 'A test business for unit testing',
  brandVoice: 'Professional yet approachable',
  targetAudience: { age: '25-45', interests: ['tech', 'startups'] },
  colors: { primary: '#3B82F6', secondary: '#10B981', accent: '#8B5CF6' },
};

const mockRequest: TextGenerationRequest = {
  userId: 'user-123',
  businessId: 'biz-456',
  prompt: 'Launch announcement for our new AI product',
  platforms: ['instagram', 'twitter'],
  template: 'announcement',
  includeHashtags: true,
  variantCount: 2,
};

describe('Text Generation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateText', () => {
    it('should generate text variants for specified platforms', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variants: [
                  {
                    text: 'Exciting news! TestBiz launches AI product 🚀',
                    hashtags: ['AI', 'TechLaunch', 'Innovation'],
                    platform: 'instagram',
                  },
                  {
                    text: 'We just launched our AI product! 🎉',
                    hashtags: ['AI', 'Launch'],
                    platform: 'twitter',
                  },
                  {
                    text: 'Big day at TestBiz! Our new AI tool is here ✨',
                    hashtags: ['AIProduct', 'Startup'],
                    platform: 'instagram',
                  },
                  {
                    text: 'Introducing our AI product today!',
                    hashtags: ['NewProduct'],
                    platform: 'twitter',
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 500, completion_tokens: 200 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      const result = await generateText(mockRequest, mockBrand);

      expect(result.variants).toHaveLength(4);
      expect(result.model).toBe('gpt-4o');
      expect(result.tokensInput).toBe(500);
      expect(result.tokensOutput).toBe(200);
      expect(result.costCents).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Check platform distribution
      const instagramVariants = result.variants.filter(
        (v) => v.platform === 'instagram'
      );
      const twitterVariants = result.variants.filter(
        (v) => v.platform === 'twitter'
      );
      expect(instagramVariants.length).toBeGreaterThan(0);
      expect(twitterVariants.length).toBeGreaterThan(0);
    });

    it('should strip # from hashtags in response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variants: [
                  {
                    text: 'Test post',
                    hashtags: ['#WithHash', 'WithoutHash'],
                    platform: 'instagram',
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      const result = await generateText(
        { ...mockRequest, platforms: ['instagram'], variantCount: 1 },
        mockBrand
      );

      expect(result.variants[0].hashtags).toEqual([
        'WithHash',
        'WithoutHash',
      ]);
    });

    it('should include characterCount for each variant', async () => {
      const text = 'Hello World!';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variants: [
                  { text, hashtags: [], platform: 'twitter' },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      const result = await generateText(
        { ...mockRequest, platforms: ['twitter'], variantCount: 1 },
        mockBrand
      );

      expect(result.variants[0].characterCount).toBe(text.length);
    });

    it('should throw when no content is returned', async () => {
      const mockResponse = {
        choices: [{ message: { content: null } }],
        usage: { prompt_tokens: 100, completion_tokens: 0 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      await expect(generateText(mockRequest, mockBrand)).rejects.toThrow(
        'No content returned from text generation'
      );
    });

    it('should use JSON response format', async () => {
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

      await generateText(mockRequest, mockBrand);

      expect(openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
        })
      );
    });

    it('should include brand context in system prompt', async () => {
      const mockResponse = {
        choices: [
          { message: { content: JSON.stringify({ variants: [] }) } },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      await generateText(mockRequest, mockBrand);

      const call = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
      const systemMsg = (call.messages as any[]).find(
        (m: any) => m.role === 'system'
      );

      expect(systemMsg.content).toContain('Professional yet approachable');
      expect(systemMsg.content).toContain('Technology');
      expect(systemMsg.content).toContain('TestBiz');
    });
  });

  describe('generateHashtags', () => {
    it('should return hashtags without # prefix', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                hashtags: ['#tech', 'AI', '#startup'],
              }),
            },
          },
        ],
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      const result = await generateHashtags('technology trends', 'instagram');

      expect(result).toEqual(['tech', 'AI', 'startup']);
    });

    it('should return empty array when no content', async () => {
      const mockResponse = {
        choices: [{ message: { content: null } }],
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      const result = await generateHashtags('test', 'twitter');
      expect(result).toEqual([]);
    });
  });
});
