import { describe, it, expect } from 'vitest';
import { scoreContent } from '../content-quality-scoring';

describe('scoreContent', () => {
  describe('overallScore', () => {
    it('should return a score between 0 and 100', () => {
      const result = scoreContent('This is a test post about marketing', 'instagram');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('should return a very low score for empty text', () => {
      const result = scoreContent('', 'instagram');
      expect(result.overallScore).toBeLessThan(30);
      expect(result.dimensions.hookStrength).toBe(0);
    });

    it('should return all 5 quality dimensions', () => {
      const result = scoreContent('Check out our new product launch!', 'instagram');
      expect(result.dimensions).toHaveProperty('readability');
      expect(result.dimensions).toHaveProperty('hookStrength');
      expect(result.dimensions).toHaveProperty('ctaClarity');
      expect(result.dimensions).toHaveProperty('platformFit');
      expect(result.dimensions).toHaveProperty('authenticity');
    });
  });

  describe('readability', () => {
    it('should score short sentences higher', () => {
      const short = scoreContent('Quick wins. Simple tips. Try this today.', 'twitter');
      const long = scoreContent(
        'In the ever-evolving landscape of digital marketing strategies and social media engagement optimization techniques that are continuously being developed by industry professionals across the globe.',
        'twitter'
      );
      expect(short.dimensions.readability).toBeGreaterThan(long.dimensions.readability);
    });

    it('should give a bonus for line breaks', () => {
      const withBreaks = scoreContent('First point.\n\nSecond point.\n\nThird point.', 'linkedin');
      const withoutBreaks = scoreContent('First point. Second point. Third point.', 'linkedin');
      expect(withBreaks.dimensions.readability).toBeGreaterThanOrEqual(withoutBreaks.dimensions.readability);
    });
  });

  describe('hookStrength', () => {
    it('should score question hooks higher', () => {
      const question = scoreContent('Are you making this common mistake?\nHere is why it matters.', 'instagram');
      const bland = scoreContent('Here is some information about marketing.\nIt is important.', 'instagram');
      expect(question.dimensions.hookStrength).toBeGreaterThan(bland.dimensions.hookStrength);
    });

    it('should score number/stat hooks higher', () => {
      const numbered = scoreContent('5 ways to boost your engagement today\nTry these tips.', 'instagram');
      const generic = scoreContent('Some ways to boost your engagement\nTry these tips.', 'instagram');
      expect(numbered.dimensions.hookStrength).toBeGreaterThan(generic.dimensions.hookStrength);
    });

    it('should score power words higher', () => {
      const power = scoreContent('The surprising truth about AI marketing\nYou need to know this.', 'instagram');
      const plain = scoreContent('Some thoughts on AI marketing\nYou need to know this.', 'instagram');
      expect(power.dimensions.hookStrength).toBeGreaterThan(plain.dimensions.hookStrength);
    });

    it('should penalize weak greeting hooks', () => {
      const weak = scoreContent('Hello everyone! Welcome to our page.\nWe are excited.', 'instagram');
      const strong = scoreContent('Stop scrolling. This will change how you think about AI.\nSeriously.', 'instagram');
      expect(strong.dimensions.hookStrength).toBeGreaterThan(weak.dimensions.hookStrength);
    });
  });

  describe('ctaClarity', () => {
    it('should score posts with CTA at the end higher', () => {
      const withCta = scoreContent('Great content about marketing.\n\nFollow us for more tips!', 'instagram');
      const withoutCta = scoreContent('Great content about marketing.\n\nThat is all for today.', 'instagram');
      expect(withCta.dimensions.ctaClarity).toBeGreaterThan(withoutCta.dimensions.ctaClarity);
    });

    it('should reward ending with a question', () => {
      const question = scoreContent('AI is transforming marketing.\n\nWhat do you think about this trend?', 'linkedin');
      const statement = scoreContent('AI is transforming marketing.\n\nThis is an important trend.', 'linkedin');
      expect(question.dimensions.ctaClarity).toBeGreaterThan(statement.dimensions.ctaClarity);
    });

    it('should reward urgency language', () => {
      const urgent = scoreContent('New product launch.\n\nGrab yours now before they sell out!', 'instagram');
      const calm = scoreContent('New product launch.\n\nCheck our product page for details.', 'instagram');
      expect(urgent.dimensions.ctaClarity).toBeGreaterThan(calm.dimensions.ctaClarity);
    });
  });

  describe('platformFit', () => {
    it('should score short content higher for twitter', () => {
      const short = scoreContent('Quick take on AI trends. The future is now.', 'twitter');
      const tooLong = scoreContent('A'.repeat(300), 'twitter');
      expect(short.dimensions.platformFit).toBeGreaterThan(tooLong.dimensions.platformFit);
    });

    it('should penalize tweets over 280 chars', () => {
      const overLimit = scoreContent('A'.repeat(300), 'twitter');
      expect(overLimit.suggestions).toContain('Tweet exceeds 280 character limit');
    });

    it('should factor in hashtag count', () => {
      const goodHashtags = scoreContent('Test post', 'instagram', ['AI', 'Tech', 'Marketing', 'Growth', 'Tips']);
      const noHashtags = scoreContent('Test post', 'instagram', []);
      expect(goodHashtags.dimensions.platformFit).toBeGreaterThan(noHashtags.dimensions.platformFit);
    });
  });

  describe('authenticity', () => {
    it('should penalize placeholder text', () => {
      const placeholder = scoreContent('[insert your brand name here] is great!', 'instagram');
      const real = scoreContent('TrueTwist is great! We love helping you grow.', 'instagram');
      expect(real.dimensions.authenticity).toBeGreaterThan(placeholder.dimensions.authenticity);
    });

    it('should penalize corporate jargon', () => {
      const jargon = scoreContent('We leverage synergy to move the needle on your paradigm shift.', 'linkedin');
      const natural = scoreContent('We help you grow your audience with smart strategies.', 'linkedin');
      expect(natural.dimensions.authenticity).toBeGreaterThan(jargon.dimensions.authenticity);
    });

    it('should reward specific content with numbers', () => {
      const specific = scoreContent('We grew 150% in 3 months using these 5 strategies.', 'linkedin');
      const vague = scoreContent('We grew a lot using some strategies over time.', 'linkedin');
      expect(specific.dimensions.authenticity).toBeGreaterThan(vague.dimensions.authenticity);
    });
  });

  describe('suggestions', () => {
    it('should suggest improvements for weak content', () => {
      const result = scoreContent('[insert topic] is important.', 'instagram');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest CTA when missing', () => {
      const result = scoreContent('Here is some information about our product. It is good.', 'instagram');
      expect(result.suggestions).toContain('Add a clear call-to-action at the end of your post');
    });
  });
});
