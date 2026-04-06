import { describe, it, expect, vi, beforeEach } from 'vitest';
import { optimizeAdBudget } from '../ad-optimization-service';
import type { BrandContext, AdBudgetAllocationRequest } from '../types';

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

const mockRequest: AdBudgetAllocationRequest = {
  userId: 'user-123',
  businessId: 'biz-456',
  totalBudget: 10000,
  platforms: ['meta', 'google'],
  historicalMetrics: [
    {
      platform: 'meta',
      campaignId: 'camp-1',
      spend: 3000,
      impressions: 500000,
      clicks: 15000,
      conversions: 300,
      revenue: 9600,
      ctr: 3.0,
      cpc: 0.2,
      roas: 3.2,
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
    },
    {
      platform: 'google',
      campaignId: 'camp-2',
      spend: 2000,
      impressions: 200000,
      clicks: 8000,
      conversions: 120,
      revenue: 4400,
      ctr: 4.0,
      cpc: 0.25,
      roas: 2.2,
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
    },
  ],
  objective: 'conversions',
};

describe('Ad Optimization Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('optimizeAdBudget', () => {
    it('should return budget allocations with projected ROAS and insights', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                allocations: [
                  {
                    platform: 'meta',
                    campaignId: 'camp-1',
                    recommendedBudgetPct: 60,
                    confidence: 0.85,
                    reasoning: 'Highest ROAS at $3.20 with strong engagement',
                  },
                  {
                    platform: 'google',
                    campaignId: 'camp-2',
                    recommendedBudgetPct: 40,
                    confidence: 0.75,
                    reasoning: 'Higher CTR but lower ROAS — good for brand awareness',
                  },
                ],
                totalProjectedRoas: 2.8,
                insights: [
                  'Meta campaigns show strongest conversion performance',
                  'Consider increasing Google spend during peak search hours',
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 800, completion_tokens: 300 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      const result = await optimizeAdBudget(mockRequest, mockBrand);

      expect(result.allocations).toHaveLength(2);
      expect(result.totalProjectedRoas).toBe(2.8);
      expect(result.insights).toHaveLength(2);
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.costCents).toBeGreaterThan(0);

      // Check allocation amounts are calculated correctly
      const metaAlloc = result.allocations.find((a) => a.platform === 'meta');
      expect(metaAlloc).toBeDefined();
      expect(metaAlloc!.recommendedBudgetPct).toBe(60);
      expect(metaAlloc!.recommendedBudgetAmount).toBe(6000);

      const googleAlloc = result.allocations.find((a) => a.platform === 'google');
      expect(googleAlloc).toBeDefined();
      expect(googleAlloc!.recommendedBudgetAmount).toBe(4000);
    });

    it('should use low temperature for analytical decisions', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                allocations: [],
                totalProjectedRoas: 0,
                insights: [],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      await optimizeAdBudget(mockRequest, mockBrand);

      expect(openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.4,
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

      await expect(optimizeAdBudget(mockRequest, mockBrand)).rejects.toThrow(
        'No content returned from budget allocation'
      );
    });

    it('should handle requests with no historical data', async () => {
      const noHistoryRequest = {
        ...mockRequest,
        historicalMetrics: [],
      };

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                allocations: [
                  {
                    platform: 'meta',
                    recommendedBudgetPct: 50,
                    confidence: 0.5,
                    reasoning: 'No data — recommend even split for initial testing',
                  },
                  {
                    platform: 'google',
                    recommendedBudgetPct: 50,
                    confidence: 0.5,
                    reasoning: 'No data — recommend even split for initial testing',
                  },
                ],
                totalProjectedRoas: 1.5,
                insights: ['Start with even split and optimize after collecting data'],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 400, completion_tokens: 200 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      const result = await optimizeAdBudget(noHistoryRequest, mockBrand);

      expect(result.allocations).toHaveLength(2);
      // Lower confidence when no data
      expect(result.allocations[0].confidence).toBeLessThanOrEqual(0.6);
    });

    it('should include brand context in system prompt', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                allocations: [],
                totalProjectedRoas: 0,
                insights: [],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(
        mockResponse as any
      );

      await optimizeAdBudget(mockRequest, mockBrand);

      const call = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
      const systemMsg = (call.messages as any[]).find(
        (m: any) => m.role === 'system'
      );

      expect(systemMsg.content).toContain('E-commerce');
      expect(systemMsg.content).toContain('Online store selling tech accessories');
    });
  });
});
