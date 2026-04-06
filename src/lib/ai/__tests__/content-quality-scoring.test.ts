import { describe, it, expect } from 'vitest';
import { scoreContent } from '../content-quality-scoring';
import type { Platform } from '@/lib/social/types';

describe('Content Quality Scoring', () => {
  describe('scoreContent', () => {
    it('returns all 5 dimension scores and an overall score', () => {
      const result = scoreContent('Check out our new product! 🚀\n\nThis changes everything.\nComment below if you agree!', 'instagram');
      expect(result).toHaveProperty('overall');
      expect(result).toHaveProperty('readability');
      expect(result).toHaveProperty('hookStrength');
      expect(result).toHaveProperty('ctaClarity');
      expect(result).toHaveProperty('platformFit');
      expect(result).toHaveProperty('authenticity');
      expect(result).toHaveProperty('suggestions');
    });

    it('scores are all between 0 and 100', () => {
      const result = scoreContent('Hello world', 'twitter');
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
      expect(result.readability).toBeGreaterThanOrEqual(0);
      expect(result.readability).toBeLessThanOrEqual(100);
      expect(result.hookStrength).toBeGreaterThanOrEqual(0);
      expect(result.hookStrength).toBeLessThanOrEqual(100);
      expect(result.ctaClarity).toBeGreaterThanOrEqual(0);
      expect(result.ctaClarity).toBeLessThanOrEqual(100);
      expect(result.platformFit).toBeGreaterThanOrEqual(0);
      expect(result.platformFit).toBeLessThanOrEqual(100);
      expect(result.authenticity).toBeGreaterThanOrEqual(0);
      expect(result.authenticity).toBeLessThanOrEqual(100);
    });

    it('gives higher hook score for strong opening patterns', () => {
      const weakHook = scoreContent('Our company has been doing great work in the field of technology and innovation.', 'instagram');
      const strongHook = scoreContent('Stop scrolling. This one trick doubled our revenue in 30 days.\n\nHere\'s how we did it.', 'instagram');
      expect(strongHook.hookStrength).toBeGreaterThan(weakHook.hookStrength);
    });

    it('gives higher CTA score when CTA phrases are present', () => {
      const noCta = scoreContent('Here is some interesting information about our product.', 'instagram');
      const withCta = scoreContent('Here is some interesting information about our product.\n\nComment below and share with a friend who needs this!', 'instagram');
      expect(withCta.ctaClarity).toBeGreaterThan(noCta.ctaClarity);
    });

    it('penalizes content exceeding platform character limit', () => {
      const longContent = 'A'.repeat(300); // exceeds Twitter 280 limit
      const result = scoreContent(longContent, 'twitter');
      expect(result.platformFit).toBeLessThan(70);
      expect(result.suggestions.some(s => s.includes('character limit'))).toBe(true);
    });

    it('gives higher readability for short sentences with line breaks', () => {
      const wall = 'This is a very long sentence that goes on and on without any breaks and keeps talking about things in a way that makes it really hard to read and follow along with the main points of the content.';
      const scannable = 'Short and punchy.\n\nEasy to read.\n\nLine breaks help.\n\nKeep it simple.';
      const wallScore = scoreContent(wall, 'instagram');
      const scannableScore = scoreContent(scannable, 'instagram');
      expect(scannableScore.readability).toBeGreaterThan(wallScore.readability);
    });

    it('penalizes generic marketing language for authenticity', () => {
      const generic = 'In today\'s fast-paced world, this game-changer solution will unlock your potential and take it to the next level! Amazing opportunity!';
      const authentic = 'I spent 3 months testing this with 200 customers. 78% saw results in week 1. Here\'s what we learned.';
      const genericScore = scoreContent(generic, 'linkedin');
      const authenticScore = scoreContent(authentic, 'linkedin');
      expect(authenticScore.authenticity).toBeGreaterThan(genericScore.authenticity);
    });

    it('rewards moderate emoji usage', () => {
      const noEmoji = scoreContent('Check out our new product launch.', 'instagram');
      const goodEmoji = scoreContent('Check out our new product launch 🚀✨', 'instagram');
      expect(goodEmoji.readability).toBeGreaterThanOrEqual(noEmoji.readability);
    });

    it('penalizes excessive exclamation marks', () => {
      const calm = scoreContent('This is our new product. We think you will love it.', 'instagram');
      const excited = scoreContent('This is our new product!!! You will LOVE it!!!! Amazing!!!!', 'instagram');
      expect(calm.authenticity).toBeGreaterThanOrEqual(excited.authenticity);
    });

    it('gives higher platform fit for Twitter-appropriate short content', () => {
      const short = scoreContent('Big news dropping tomorrow. Stay tuned.', 'twitter');
      expect(short.platformFit).toBeGreaterThan(60);
    });

    it('gives higher platform fit for LinkedIn long-form content', () => {
      const longForm = 'I spent the last decade building B2B SaaS companies.\n\n' +
        'The biggest lesson? Focus on retention, not acquisition.\n\n' +
        'Here are 5 things I learned:\n\n' +
        '1. Your first 100 customers teach you everything.\n' +
        '2. Churn is a product problem, not a sales problem.\n' +
        '3. NPS is a lagging indicator — track activation instead.\n' +
        '4. The best growth engine is a product people recommend.\n' +
        '5. Revenue follows retention, always.\n\n' +
        'What\'s the biggest lesson you\'ve learned in SaaS? Share below.';
      const result = scoreContent(longForm, 'linkedin');
      expect(result.platformFit).toBeGreaterThanOrEqual(65);
    });

    it('gives bonus for specific data in authenticity scoring', () => {
      const vague = scoreContent('Our product helps lots of people succeed.', 'instagram');
      const specific = scoreContent('Our product helped 2,400 users save $15,000 each last quarter.', 'instagram');
      expect(specific.authenticity).toBeGreaterThan(vague.authenticity);
    });

    it('returns suggestions array', () => {
      const result = scoreContent('Bad content.', 'instagram');
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('overall score is weighted average of dimensions', () => {
      const result = scoreContent('Stop! This changes everything.\n\nShare this with someone who needs to hear it.', 'instagram');
      // Verify overall is reasonable (weighted average should be between min and max dimensions)
      const dims = [result.readability, result.hookStrength, result.ctaClarity, result.platformFit, result.authenticity];
      expect(result.overall).toBeGreaterThanOrEqual(Math.min(...dims) - 1);
      expect(result.overall).toBeLessThanOrEqual(Math.max(...dims) + 1);
    });

    it('handles empty string gracefully', () => {
      const result = scoreContent('', 'instagram');
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
    });

    it('handles TikTok visual cues as platform fit bonus', () => {
      const withCues = scoreContent('Stop scrolling.\n[cuts to product]\nThis changed my life.\n[trending audio]', 'tiktok');
      const withoutCues = scoreContent('Stop scrolling. This changed my life.', 'tiktok');
      expect(withCues.platformFit).toBeGreaterThanOrEqual(withoutCues.platformFit);
    });
  });
});
