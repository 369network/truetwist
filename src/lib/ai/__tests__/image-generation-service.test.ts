import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateImage } from '../image-generation-service';
import type { BrandContext, ImageGenerationRequest } from '../types';

vi.mock('../openai-client', () => ({
  openai: {
    images: {
      generate: vi.fn(),
    },
  },
}));

import { openai } from '../openai-client';

const mockBrand: BrandContext = {
  businessName: 'TestBiz',
  industry: 'Fashion',
  colors: { primary: '#FF5733', secondary: '#33FF57', accent: '#3357FF' },
};

const mockRequest: ImageGenerationRequest = {
  userId: 'user-123',
  businessId: 'biz-456',
  prompt: 'A modern product showcase',
  platform: 'instagram',
  style: 'minimalist',
  template: 'product-showcase',
};

describe('Image Generation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a single image by default', async () => {
    vi.mocked(openai.images.generate).mockResolvedValue({
      data: [
        {
          url: 'https://example.com/image1.png',
          revised_prompt: 'A clean product showcase',
        },
      ],
    } as any);

    const result = await generateImage(mockRequest, mockBrand);

    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe('https://example.com/image1.png');
    expect(result.model).toBe('dall-e-3');
    expect(result.costCents).toBeGreaterThan(0);
  });

  it('should generate multiple images when count > 1', async () => {
    vi.mocked(openai.images.generate).mockResolvedValue({
      data: [
        {
          url: 'https://example.com/image.png',
          revised_prompt: 'generated',
        },
      ],
    } as any);

    const result = await generateImage(
      { ...mockRequest, count: 3 },
      mockBrand
    );

    expect(result.images).toHaveLength(3);
    expect(openai.images.generate).toHaveBeenCalledTimes(3);
  });

  it('should cap count at 4', async () => {
    vi.mocked(openai.images.generate).mockResolvedValue({
      data: [{ url: 'https://example.com/img.png', revised_prompt: 'ok' }],
    } as any);

    const result = await generateImage(
      { ...mockRequest, count: 10 },
      mockBrand
    );

    expect(result.images).toHaveLength(4);
    expect(openai.images.generate).toHaveBeenCalledTimes(4);
  });

  it('should select vertical size for TikTok', async () => {
    vi.mocked(openai.images.generate).mockResolvedValue({
      data: [{ url: 'https://example.com/img.png', revised_prompt: 'ok' }],
    } as any);

    await generateImage(
      { ...mockRequest, platform: 'tiktok' },
      mockBrand
    );

    expect(openai.images.generate).toHaveBeenCalledWith(
      expect.objectContaining({ size: '1024x1792' })
    );
  });

  it('should select landscape size for Twitter', async () => {
    vi.mocked(openai.images.generate).mockResolvedValue({
      data: [{ url: 'https://example.com/img.png', revised_prompt: 'ok' }],
    } as any);

    await generateImage(
      { ...mockRequest, platform: 'twitter' },
      mockBrand
    );

    expect(openai.images.generate).toHaveBeenCalledWith(
      expect.objectContaining({ size: '1792x1024' })
    );
  });

  it('should select square size for Instagram by default', async () => {
    vi.mocked(openai.images.generate).mockResolvedValue({
      data: [{ url: 'https://example.com/img.png', revised_prompt: 'ok' }],
    } as any);

    await generateImage(mockRequest, mockBrand);

    expect(openai.images.generate).toHaveBeenCalledWith(
      expect.objectContaining({ size: '1024x1024' })
    );
  });

  it('should respect explicit size override', async () => {
    vi.mocked(openai.images.generate).mockResolvedValue({
      data: [{ url: 'https://example.com/img.png', revised_prompt: 'ok' }],
    } as any);

    await generateImage(
      { ...mockRequest, size: '1792x1024' },
      mockBrand
    );

    expect(openai.images.generate).toHaveBeenCalledWith(
      expect.objectContaining({ size: '1792x1024' })
    );
  });

  it('should include brand colors in prompt', async () => {
    vi.mocked(openai.images.generate).mockResolvedValue({
      data: [{ url: 'https://example.com/img.png', revised_prompt: 'ok' }],
    } as any);

    await generateImage(mockRequest, mockBrand);

    const call = vi.mocked(openai.images.generate).mock.calls[0][0];
    expect(call.prompt).toContain('#FF5733');
    expect(call.prompt).toContain('#33FF57');
  });

  it('should calculate cost correctly for square images', async () => {
    vi.mocked(openai.images.generate).mockResolvedValue({
      data: [{ url: 'https://example.com/img.png', revised_prompt: 'ok' }],
    } as any);

    const result = await generateImage(
      { ...mockRequest, count: 2 },
      mockBrand
    );

    // 1024x1024 = 4 cents per image, 2 images = 8 cents
    expect(result.costCents).toBe(8);
  });
});
