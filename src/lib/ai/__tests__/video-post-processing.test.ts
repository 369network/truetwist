import { describe, it, expect } from 'vitest';
import {
  getPrimaryFormat,
  getPlatformFormats,
  getDimensions,
  clampDuration,
  getAvailableDurations,
  buildPostProcessingSpec,
  generateSrt,
  getBatchVariantTargets,
  PLATFORM_FORMATS,
} from '../video-post-processing';

describe('Video Post-Processing', () => {
  describe('getPrimaryFormat', () => {
    it('should return 9:16 for TikTok', () => {
      const spec = getPrimaryFormat('tiktok');
      expect(spec.aspectRatio).toBe('9:16');
      expect(spec.width).toBe(1080);
      expect(spec.height).toBe(1920);
    });

    it('should return 16:9 for YouTube', () => {
      const spec = getPrimaryFormat('youtube');
      expect(spec.aspectRatio).toBe('16:9');
      expect(spec.width).toBe(1920);
      expect(spec.height).toBe(1080);
    });

    it('should return default for unknown platform', () => {
      const spec = getPrimaryFormat('unknown' as any);
      expect(spec.aspectRatio).toBe('16:9');
    });
  });

  describe('getPlatformFormats', () => {
    it('should return multiple formats for Instagram', () => {
      const formats = getPlatformFormats('instagram');
      expect(formats.length).toBe(2);
      const ratios = formats.map((f) => f.aspectRatio);
      expect(ratios).toContain('9:16');
      expect(ratios).toContain('1:1');
    });
  });

  describe('getDimensions', () => {
    it('should return correct dimensions for each ratio', () => {
      expect(getDimensions('9:16')).toEqual({ width: 1080, height: 1920 });
      expect(getDimensions('16:9')).toEqual({ width: 1920, height: 1080 });
      expect(getDimensions('1:1')).toEqual({ width: 1080, height: 1080 });
    });
  });

  describe('clampDuration', () => {
    it('should clamp to minimum of 5 seconds', () => {
      expect(clampDuration('tiktok', 2)).toBe(5);
    });

    it('should clamp to platform max', () => {
      expect(clampDuration('tiktok', 120)).toBe(60);
      expect(clampDuration('linkedin', 120)).toBe(30);
    });

    it('should pass through valid durations', () => {
      expect(clampDuration('tiktok', 30)).toBe(30);
    });
  });

  describe('getAvailableDurations', () => {
    it('should return valid durations for TikTok', () => {
      const durations = getAvailableDurations('tiktok');
      expect(durations).toEqual([15, 30, 60]);
    });
  });

  describe('buildPostProcessingSpec', () => {
    it('should build correct spec for TikTok 9:16', () => {
      const spec = buildPostProcessingSpec({
        sourceVideoUrl: 'https://cdn.example.com/video.mp4',
        platform: 'tiktok',
        aspectRatio: '9:16',
        durationSeconds: 15,
      });

      expect(spec.output.width).toBe(1080);
      expect(spec.output.height).toBe(1920);
      expect(spec.output.format).toBe('mp4');
      expect(spec.operations).toContain('resize:1080x1920');
      expect(spec.operations).toContain('encode:h264_aac_mp4');
    });

    it('should include watermark operation when specified', () => {
      const spec = buildPostProcessingSpec({
        sourceVideoUrl: 'https://cdn.example.com/video.mp4',
        platform: 'instagram',
        aspectRatio: '9:16',
        durationSeconds: 15,
        options: {
          watermark: {
            logoUrl: 'https://example.com/logo.png',
            position: 'bottom-right',
            opacity: 0.8,
            scale: 0.15,
          },
        },
      });

      expect(spec.operations).toContain('watermark:bottom-right');
      expect(spec.watermark?.logoUrl).toBe('https://example.com/logo.png');
    });

    it('should include trim and burn_captions operations', () => {
      const spec = buildPostProcessingSpec({
        sourceVideoUrl: 'https://cdn.example.com/video.mp4',
        platform: 'youtube',
        aspectRatio: '16:9',
        durationSeconds: 30,
        options: {
          trim: { startSeconds: 5, endSeconds: 20 },
          captions: {
            text: 'Hello world',
            style: 'burned-in',
            fontSize: 24,
            fontColor: '#FFFFFF',
            position: 'bottom',
          },
        },
      });

      expect(spec.operations).toContain('trim:5-20');
      expect(spec.operations).toContain('burn_captions');
    });
  });

  describe('generateSrt', () => {
    it('should generate valid SRT format', () => {
      const srt = generateSrt('Hello world this is a test video', 10, 4);
      const lines = srt.split('\n');

      // Should have at least one segment
      expect(lines[0]).toBe('1');
      expect(lines[1]).toContain('-->');
      expect(lines[2]).toContain('Hello');
    });

    it('should split text into segments', () => {
      const srt = generateSrt(
        'Word one two three four five six seven eight nine ten eleven twelve',
        12,
        4
      );
      // 12 words / 4 per segment = 3 segments
      expect(srt).toContain('1\n');
      expect(srt).toContain('2\n');
      expect(srt).toContain('3\n');
    });

    it('should format timestamps correctly', () => {
      const srt = generateSrt('Short text', 5, 10);
      expect(srt).toContain('00:00:00,000');
      expect(srt).toContain('00:00:05,000');
    });
  });

  describe('getBatchVariantTargets', () => {
    it('should return other platforms for batch conversion', () => {
      const targets = getBatchVariantTargets('tiktok', '9:16');
      const platforms = targets.map((t) => t.platform);

      expect(platforms).not.toContain('tiktok');
      expect(platforms).toContain('instagram');
      expect(platforms).toContain('youtube');
      expect(targets.length).toBeGreaterThan(3);
    });

    it('should prefer matching aspect ratio when available', () => {
      const targets = getBatchVariantTargets('youtube', '16:9');
      const facebook = targets.find((t) => t.platform === 'facebook');
      expect(facebook?.aspectRatio).toBe('16:9');
    });
  });

  describe('PLATFORM_FORMATS', () => {
    it('should have specs for all major platforms', () => {
      const platforms = ['tiktok', 'instagram', 'youtube', 'facebook', 'linkedin', 'twitter', 'pinterest', 'threads'];
      for (const p of platforms) {
        expect(PLATFORM_FORMATS[p]).toBeDefined();
        expect(PLATFORM_FORMATS[p].length).toBeGreaterThan(0);
      }
    });
  });
});
