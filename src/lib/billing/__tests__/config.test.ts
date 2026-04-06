import { describe, it, expect } from 'vitest';
import {
  PLAN_CONFIGS,
  CREDIT_COSTS,
  CREDIT_TOPUP,
  TRIAL_DAYS,
  CREDIT_WARNING_THRESHOLD,
  getPlanFromPriceKey,
  getIntervalFromPriceKey,
} from '../config';

describe('BillingConfig', () => {
  describe('PLAN_CONFIGS', () => {
    it('should define all four plan tiers', () => {
      expect(PLAN_CONFIGS).toHaveProperty('free');
      expect(PLAN_CONFIGS).toHaveProperty('starter');
      expect(PLAN_CONFIGS).toHaveProperty('pro');
      expect(PLAN_CONFIGS).toHaveProperty('enterprise');
    });

    it('should have correct pricing', () => {
      expect(PLAN_CONFIGS.free.monthlyPriceCents).toBe(0);
      expect(PLAN_CONFIGS.starter.monthlyPriceCents).toBe(2900);
      expect(PLAN_CONFIGS.pro.monthlyPriceCents).toBe(7900);
      expect(PLAN_CONFIGS.enterprise.monthlyPriceCents).toBe(19900);
    });

    it('should have 20% discount for annual billing', () => {
      expect(PLAN_CONFIGS.starter.annualPriceCents).toBe(2320);
      expect(PLAN_CONFIGS.pro.annualPriceCents).toBe(6320);
      expect(PLAN_CONFIGS.enterprise.annualPriceCents).toBe(15920);
    });

    it('should have correct monthly credits', () => {
      expect(PLAN_CONFIGS.free.monthlyCredits).toBe(0);
      expect(PLAN_CONFIGS.starter.monthlyCredits).toBe(100);
      expect(PLAN_CONFIGS.pro.monthlyCredits).toBe(500);
      expect(PLAN_CONFIGS.enterprise.monthlyCredits).toBe(2000);
    });
  });

  describe('CREDIT_COSTS', () => {
    it('should have correct generation costs', () => {
      expect(CREDIT_COSTS.text).toBe(1);
      expect(CREDIT_COSTS.image).toBe(5);
      expect(CREDIT_COSTS.video).toBe(20);
    });
  });

  describe('CREDIT_TOPUP', () => {
    it('should be $10 for 50 credits', () => {
      expect(CREDIT_TOPUP.priceCents).toBe(1000);
      expect(CREDIT_TOPUP.credits).toBe(50);
    });
  });

  describe('TRIAL_DAYS', () => {
    it('should be 7 days', () => {
      expect(TRIAL_DAYS).toBe(7);
    });
  });

  describe('CREDIT_WARNING_THRESHOLD', () => {
    it('should be 80%', () => {
      expect(CREDIT_WARNING_THRESHOLD).toBe(0.8);
    });
  });

  describe('getPlanFromPriceKey', () => {
    it('should extract plan from lookup key', () => {
      expect(getPlanFromPriceKey('starter_monthly')).toBe('starter');
      expect(getPlanFromPriceKey('pro_annual')).toBe('pro');
      expect(getPlanFromPriceKey('enterprise_monthly')).toBe('enterprise');
    });

    it('should return null for unknown keys', () => {
      expect(getPlanFromPriceKey('unknown_key')).toBeNull();
    });
  });

  describe('getIntervalFromPriceKey', () => {
    it('should extract interval from lookup key', () => {
      expect(getIntervalFromPriceKey('pro_monthly')).toBe('monthly');
      expect(getIntervalFromPriceKey('pro_annual')).toBe('annual');
    });
  });
});
