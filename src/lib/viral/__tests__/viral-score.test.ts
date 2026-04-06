import { describe, it, expect } from 'vitest';
import { computeViralScore, computeSimpleViralScore } from '../viral-score';
import type { ViralScoreInput } from '../types';

describe('Viral Score Algorithm', () => {
  const baseInput: ViralScoreInput = {
    engagements: 10000,
    followers: 50000,
    hours: 4,
    acceleration: 0.5,
    shareRatio: 0.15,
    nonFollowerReach: 100000,
    reachHours: 4,
    platform: 'twitter',
    contentFormat: 'text',
    sentimentScore: 0.3,
    peakVelocity: 100,
    currentVelocity: 80,
    ageHours: 4,
  };

  describe('computeViralScore', () => {
    it('should return a score between 0 and 100', () => {
      const result = computeViralScore(baseInput);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should return all component values', () => {
      const result = computeViralScore(baseInput);
      expect(result.components).toBeDefined();
      expect(result.components.engagementVelocity).toBeGreaterThan(0);
      expect(result.components.formatMultiplier).toBe(1.0); // text on twitter
      expect(result.components.sentimentWeight).toBeGreaterThan(1); // positive sentiment
      expect(result.components.timeDecay).toBeGreaterThan(0);
      expect(result.components.timeDecay).toBeLessThanOrEqual(1);
    });

    it('should return a lifecycle stage', () => {
      const result = computeViralScore(baseInput);
      expect(['emerging', 'rising', 'peaking', 'declining', 'expired']).toContain(result.lifecycle);
    });

    it('should give higher score for higher engagement velocity', () => {
      const lowEngagement = computeViralScore({ ...baseInput, engagements: 100 });
      const highEngagement = computeViralScore({ ...baseInput, engagements: 100000 });
      expect(highEngagement.score).toBeGreaterThan(lowEngagement.score);
    });

    it('should give higher score for higher share ratio', () => {
      const lowShares = computeViralScore({ ...baseInput, shareRatio: 0.01 });
      const highShares = computeViralScore({ ...baseInput, shareRatio: 0.5 });
      expect(highShares.score).toBeGreaterThan(lowShares.score);
    });

    it('should apply format multiplier for quote tweets on twitter', () => {
      const text = computeViralScore({ ...baseInput, contentFormat: 'text' });
      const quoteTweet = computeViralScore({ ...baseInput, contentFormat: 'quote_tweet' });
      expect(quoteTweet.score).toBeGreaterThan(text.score);
    });

    it('should apply time decay - older content gets lower scores', () => {
      const fresh = computeViralScore({ ...baseInput, ageHours: 1 });
      const old = computeViralScore({ ...baseInput, ageHours: 48 });
      expect(fresh.score).toBeGreaterThan(old.score);
    });

    it('should adapt decay based on current velocity', () => {
      // Content still gaining traction should decay slower
      const stillPopular = computeViralScore({
        ...baseInput,
        ageHours: 24,
        currentVelocity: 90,
        peakVelocity: 100,
      });
      const declining = computeViralScore({
        ...baseInput,
        ageHours: 24,
        currentVelocity: 10,
        peakVelocity: 100,
      });
      expect(stillPopular.score).toBeGreaterThan(declining.score);
    });

    it('should handle zero followers gracefully', () => {
      const result = computeViralScore({ ...baseInput, followers: 0 });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.components.engagementVelocity).toBe(0);
    });

    it('should handle zero hours gracefully', () => {
      const result = computeViralScore({ ...baseInput, hours: 0 });
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should clamp sentiment score between -1 and 1', () => {
      const negative = computeViralScore({ ...baseInput, sentimentScore: -1 });
      const positive = computeViralScore({ ...baseInput, sentimentScore: 1 });
      expect(negative.components.sentimentWeight).toBeLessThan(positive.components.sentimentWeight);
    });

    it('should use platform-specific half-lives', () => {
      // Twitter has 7h half-life, YouTube has ~139h
      const twitterOld = computeViralScore({ ...baseInput, platform: 'twitter', ageHours: 24 });
      const youtubeOld = computeViralScore({ ...baseInput, platform: 'youtube', ageHours: 24 });
      // YouTube should decay slower at 24 hours
      expect(youtubeOld.components.timeDecay).toBeGreaterThan(twitterOld.components.timeDecay);
    });

    it('should classify emerging trends correctly', () => {
      const result = computeViralScore({
        ...baseInput,
        ageHours: 1,
        acceleration: 1.0,
      });
      expect(result.lifecycle).toBe('emerging');
    });

    it('should classify declining trends correctly', () => {
      const result = computeViralScore({
        ...baseInput,
        ageHours: 12,
        acceleration: -0.5,
        currentVelocity: 30,
        peakVelocity: 100,
      });
      expect(result.lifecycle).toBe('declining');
    });
  });

  describe('computeSimpleViralScore', () => {
    it('should return a score between 0 and 100', () => {
      const score = computeSimpleViralScore(10000, 500, 'twitter');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should give higher scores for higher volume', () => {
      const low = computeSimpleViralScore(100, 10, 'youtube');
      const high = computeSimpleViralScore(1000000, 10, 'youtube');
      expect(high).toBeGreaterThan(low);
    });

    it('should give higher scores for higher velocity', () => {
      const slow = computeSimpleViralScore(1000, 1, 'twitter');
      const fast = computeSimpleViralScore(1000, 100, 'twitter');
      expect(fast).toBeGreaterThan(slow);
    });

    it('should apply platform weighting', () => {
      const twitter = computeSimpleViralScore(1000, 10, 'twitter');
      const youtube = computeSimpleViralScore(1000, 10, 'youtube');
      expect(twitter).toBeGreaterThan(youtube); // twitter has 1.2x weight
    });

    it('should handle zero volume', () => {
      const score = computeSimpleViralScore(0, 0, 'twitter');
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });
});
