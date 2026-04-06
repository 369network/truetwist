import { describe, it, expect } from 'vitest';
import {
  listTemplates,
  getTemplate,
  renderTemplate,
  VIDEO_TEMPLATES,
} from '../video-templates';
import type { BrandContext } from '../types';

const mockBrand: BrandContext = {
  businessName: 'TestCo',
  industry: 'Technology',
  colors: { primary: '#3B82F6', secondary: '#10B981', accent: '#8B5CF6' },
};

describe('Video Templates', () => {
  describe('listTemplates', () => {
    it('should return at least 5 templates', () => {
      const templates = listTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(5);
    });

    it('should have required template IDs', () => {
      const ids = listTemplates().map((t) => t.id);
      expect(ids).toContain('text-animation');
      expect(ids).toContain('product-showcase');
      expect(ids).toContain('before-after');
      expect(ids).toContain('testimonial');
      expect(ids).toContain('stat-reveal');
      expect(ids).toContain('tip-carousel');
      expect(ids).toContain('talking-head');
      expect(ids).toContain('slideshow');
    });
  });

  describe('getTemplate', () => {
    it('should return a template by ID', () => {
      const template = getTemplate('before-after');
      expect(template).toBeDefined();
      expect(template!.name).toBe('Before & After');
      expect(template!.category).toBe('social-proof');
    });

    it('should return undefined for unknown template', () => {
      expect(getTemplate('nonexistent' as any)).toBeUndefined();
    });
  });

  describe('renderTemplate', () => {
    it('should render text-animation template', () => {
      const result = renderTemplate({
        templateId: 'text-animation',
        platform: 'tiktok',
        aspectRatio: '9:16',
        durationSeconds: 10,
        brand: mockBrand,
        content: { headline: 'Breaking News', bodyText: 'Something amazing happened' },
      });

      expect(result.prompt).toContain('text animation');
      expect(result.scenes.length).toBeGreaterThanOrEqual(2);
      expect(result.musicMood).toBeDefined();
    });

    it('should render product-showcase template', () => {
      const result = renderTemplate({
        templateId: 'product-showcase',
        platform: 'instagram',
        aspectRatio: '9:16',
        durationSeconds: 15,
        brand: mockBrand,
        content: {
          productName: 'SuperWidget',
          productDescription: 'The best widget ever made',
          callToAction: 'Buy now!',
        },
      });

      expect(result.prompt).toContain('SuperWidget');
      expect(result.scenes.length).toBe(4);
      expect(result.voiceoverScript).toContain('SuperWidget');
    });

    it('should render before-after template', () => {
      const result = renderTemplate({
        templateId: 'before-after',
        platform: 'youtube',
        aspectRatio: '16:9',
        durationSeconds: 10,
        brand: mockBrand,
        content: {
          beforeDescription: 'Messy code',
          afterDescription: 'Clean architecture',
        },
      });

      expect(result.prompt).toContain('before/after');
      expect(result.scenes.length).toBe(3);
      expect(result.scenes[0].transition).toBe('wipe');
    });

    it('should render testimonial template', () => {
      const result = renderTemplate({
        templateId: 'testimonial',
        platform: 'linkedin',
        aspectRatio: '16:9',
        durationSeconds: 10,
        brand: mockBrand,
        content: {
          testimonialQuote: 'This product changed my life!',
          testimonialAuthor: 'Jane Doe',
        },
      });

      expect(result.prompt).toContain('testimonial');
      expect(result.voiceoverScript).toContain('Jane Doe');
    });

    it('should render stat-reveal template', () => {
      const result = renderTemplate({
        templateId: 'stat-reveal',
        platform: 'twitter',
        aspectRatio: '16:9',
        durationSeconds: 10,
        brand: mockBrand,
        content: {
          headline: 'Our 2026 Results',
          stats: [
            { label: 'Revenue', value: '$10M' },
            { label: 'Users', value: '500K' },
            { label: 'Growth', value: '200%' },
          ],
        },
      });

      expect(result.scenes.length).toBe(4); // headline + 3 stats
      expect(result.prompt).toContain('$10M');
    });

    it('should render tip-carousel template', () => {
      const result = renderTemplate({
        templateId: 'tip-carousel',
        platform: 'tiktok',
        aspectRatio: '9:16',
        durationSeconds: 15,
        brand: mockBrand,
        content: {
          tips: ['Stay hydrated', 'Exercise daily', 'Get enough sleep'],
          headline: '3 Health Tips',
        },
      });

      // intro + 3 tips + outro = 5
      expect(result.scenes.length).toBe(5);
      expect(result.prompt).toContain('3 tips');
    });

    it('should include brand colors in prompt', () => {
      const result = renderTemplate({
        templateId: 'text-animation',
        platform: 'instagram',
        aspectRatio: '1:1',
        durationSeconds: 10,
        brand: mockBrand,
        content: { headline: 'Test' },
      });

      expect(result.prompt).toContain('#3B82F6');
    });

    it('should throw for unknown template', () => {
      expect(() =>
        renderTemplate({
          templateId: 'nonexistent' as any,
          platform: 'tiktok',
          aspectRatio: '9:16',
          durationSeconds: 10,
          brand: mockBrand,
          content: {},
        })
      ).toThrow('Unknown template');
    });
  });

  describe('template definitions', () => {
    it('should have valid scene count ranges', () => {
      for (const [id, def] of Object.entries(VIDEO_TEMPLATES)) {
        expect(def.sceneCount.min).toBeLessThanOrEqual(def.sceneCount.max);
        expect(def.sceneCount.min).toBeGreaterThan(0);
      }
    });

    it('should have supported durations within valid range', () => {
      for (const [id, def] of Object.entries(VIDEO_TEMPLATES)) {
        for (const d of def.supportedDurations) {
          expect(d).toBeGreaterThanOrEqual(5);
          expect(d).toBeLessThanOrEqual(60);
        }
      }
    });

    it('should have at least one supported aspect ratio', () => {
      for (const [id, def] of Object.entries(VIDEO_TEMPLATES)) {
        expect(def.supportedAspectRatios.length).toBeGreaterThan(0);
      }
    });
  });
});
