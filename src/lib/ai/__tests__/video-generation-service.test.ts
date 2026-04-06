import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateVideo, generateVideoScript } from '../video-generation-service';
import type { BrandContext, VideoGenerationRequest } from '../types';

vi.mock('../openai-client', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
    images: {
      generate: vi.fn(),
    },
  },
}));

import { openai } from '../openai-client';

const mockBrand: BrandContext = {
  businessName: 'TestBiz',
  industry: 'Fitness',
  colors: { primary: '#FF0000', secondary: '#00FF00', accent: '#0000FF' },
};

const mockRequest: VideoGenerationRequest = {
  userId: 'user-123',
  businessId: 'biz-456',
  prompt: 'Workout of the day announcement',
  platform: 'tiktok',
  template: 'text-animation',
  durationSeconds: 10,
};

describe('Video Generation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateVideo', () => {
    it('should generate a video script and thumbnail', async () => {
      const scriptJson = {
        title: 'Workout of the Day',
        scenes: [
          {
            sceneNumber: 1,
            durationSeconds: 3,
            visualDescription: 'Energetic opening with brand colors',
            textOverlay: 'WORKOUT OF THE DAY',
            transition: 'fade',
          },
          {
            sceneNumber: 2,
            durationSeconds: 4,
            visualDescription: 'Exercise demonstration',
            transition: 'cut',
          },
          {
            sceneNumber: 3,
            durationSeconds: 3,
            visualDescription: 'Call to action',
            textOverlay: 'Join the challenge!',
            transition: 'fade',
          },
        ],
        voiceoverScript: 'Ready for today\'s workout?',
        musicMood: 'energetic',
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(scriptJson) } }],
        usage: { prompt_tokens: 300, completion_tokens: 200 },
      } as any);

      vi.mocked(openai.images.generate).mockResolvedValue({
        data: [{ url: 'https://example.com/thumb.png' }],
      } as any);

      const result = await generateVideo(mockRequest, mockBrand);

      expect(result.video.aspectRatio).toBe('9:16'); // TikTok default
      expect(result.video.durationSeconds).toBe(10);
      expect(result.video.thumbnailUrl).toBe('https://example.com/thumb.png');
      expect(result.model).toBe('gpt-4o+dall-e-3');
      expect(result.costCents).toBeGreaterThan(0);
    });

    it('should clamp duration between 5 and 15 seconds', async () => {
      vi.mocked(openai.chat.completions.create).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                scenes: [{ sceneNumber: 1, durationSeconds: 5, visualDescription: 'test', transition: 'cut' }],
              }),
            },
          },
        ],
      } as any);

      vi.mocked(openai.images.generate).mockResolvedValue({
        data: [{ url: 'https://example.com/thumb.png' }],
      } as any);

      // Test clamping to minimum
      const result1 = await generateVideo(
        { ...mockRequest, durationSeconds: 2 },
        mockBrand
      );
      expect(result1.video.durationSeconds).toBe(5);

      // Test clamping to maximum
      const result2 = await generateVideo(
        { ...mockRequest, durationSeconds: 30 },
        mockBrand
      );
      expect(result2.video.durationSeconds).toBe(15);
    });

    it('should auto-select aspect ratio from platform', async () => {
      vi.mocked(openai.chat.completions.create).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                scenes: [{ sceneNumber: 1, durationSeconds: 5, visualDescription: 'test', transition: 'cut' }],
              }),
            },
          },
        ],
      } as any);

      vi.mocked(openai.images.generate).mockResolvedValue({
        data: [{ url: 'https://example.com/thumb.png' }],
      } as any);

      // YouTube should default to 16:9
      const result = await generateVideo(
        { ...mockRequest, platform: 'youtube', aspectRatio: undefined },
        mockBrand
      );
      expect(result.video.aspectRatio).toBe('16:9');
    });

    it('should throw when script generation fails', async () => {
      vi.mocked(openai.chat.completions.create).mockResolvedValue({
        choices: [{ message: { content: null } }],
      } as any);

      await expect(generateVideo(mockRequest, mockBrand)).rejects.toThrow(
        'Failed to generate video script'
      );
    });
  });

  describe('generateVideoScript', () => {
    it('should return structured script with scenes', async () => {
      const scriptData = {
        script: 'Full narrative script here',
        scenes: [
          {
            sceneNumber: 1,
            durationSeconds: 5,
            visualDescription: 'Opening scene',
            textOverlay: 'Welcome',
            transition: 'fade',
          },
        ],
        voiceoverScript: 'Welcome to the show',
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(scriptData) } }],
      } as any);

      const result = await generateVideoScript(mockRequest, mockBrand);

      expect(result.script).toBe('Full narrative script here');
      expect(result.scenes).toHaveLength(1);
      expect(result.voiceoverScript).toBe('Welcome to the show');
    });
  });
});
