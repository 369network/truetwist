import { describe, it, expect } from 'vitest';
import { estimateModelCost, MODEL_PRICING } from '../model-config';

describe('Model Config', () => {
  describe('MODEL_PRICING', () => {
    it('has pricing for gpt-4o', () => {
      expect(MODEL_PRICING['gpt-4o']).toBeDefined();
      expect(MODEL_PRICING['gpt-4o'].inputPer1M).toBe(250);
      expect(MODEL_PRICING['gpt-4o'].outputPer1M).toBe(1000);
    });

    it('has pricing for gpt-4o-mini', () => {
      expect(MODEL_PRICING['gpt-4o-mini']).toBeDefined();
      expect(MODEL_PRICING['gpt-4o-mini'].inputPer1M).toBe(15);
      expect(MODEL_PRICING['gpt-4o-mini'].outputPer1M).toBe(60);
    });

    it('gpt-4o-mini is significantly cheaper than gpt-4o', () => {
      const miniInput = MODEL_PRICING['gpt-4o-mini'].inputPer1M;
      const fullInput = MODEL_PRICING['gpt-4o'].inputPer1M;
      expect(miniInput / fullInput).toBeLessThan(0.1); // >90% cheaper
    });
  });

  describe('estimateModelCost', () => {
    it('returns 0 for zero tokens', () => {
      expect(estimateModelCost('gpt-4o', 0, 0)).toBe(0);
    });

    it('calculates gpt-4o cost correctly', () => {
      // 1M input + 1M output = 250 + 1000 = 1250 cents
      const cost = estimateModelCost('gpt-4o', 1_000_000, 1_000_000);
      expect(cost).toBe(1250);
    });

    it('calculates gpt-4o-mini cost correctly', () => {
      // 1M input + 1M output = 15 + 60 = 75 cents
      const cost = estimateModelCost('gpt-4o-mini', 1_000_000, 1_000_000);
      expect(cost).toBe(75);
    });

    it('rounds up to nearest cent', () => {
      // Small token counts should still round up to at least 1 cent
      const cost = estimateModelCost('gpt-4o', 1000, 1000);
      expect(cost).toBeGreaterThanOrEqual(1);
    });

    it('handles typical generation token counts', () => {
      // Typical: ~500 input, ~2000 output tokens
      const gpt4oCost = estimateModelCost('gpt-4o', 500, 2000);
      const miniCost = estimateModelCost('gpt-4o-mini', 500, 2000);
      expect(miniCost).toBeLessThan(gpt4oCost);
    });
  });
});
