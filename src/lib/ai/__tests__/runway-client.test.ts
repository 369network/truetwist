import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  submitGeneration,
  getTaskStatus,
  waitForCompletion,
  estimateCostCents,
  isConfigured,
  RunwayApiError,
} from '../runway-client';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Runway Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitGeneration', () => {
    it('should submit a generation task and return task ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'task-abc-123' }),
      });

      const result = await submitGeneration({
        prompt: 'A sunset over the ocean',
        aspectRatio: '16:9',
        durationSeconds: 10,
      });

      expect(result.taskId).toBe('task-abc-123');
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/image_to_video');
      const body = JSON.parse(options.body);
      expect(body.model).toBe('gen3a_turbo');
      expect(body.ratio).toBe('1280:720');
      expect(body.duration).toBe(10);
    });

    it('should use 720:1280 for 9:16 aspect ratio', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'task-456' }),
      });

      await submitGeneration({
        prompt: 'Vertical video content',
        aspectRatio: '9:16',
        durationSeconds: 5,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.ratio).toBe('720:1280');
      expect(body.duration).toBe(5);
    });

    it('should throw RunwayApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
      });

      await expect(
        submitGeneration({
          prompt: 'test',
          aspectRatio: '16:9',
          durationSeconds: 5,
        })
      ).rejects.toThrow(RunwayApiError);
    });
  });

  describe('getTaskStatus', () => {
    it('should return task status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'task-123',
            status: 'RUNNING',
            progress: 50,
          }),
      });

      const status = await getTaskStatus('task-123');
      expect(status.id).toBe('task-123');
      expect(status.status).toBe('RUNNING');
      expect(status.progress).toBe(50);
    });
  });

  describe('waitForCompletion', () => {
    it('should poll until SUCCEEDED', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ id: 'task-1', status: 'RUNNING', progress: 50 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'task-1',
              status: 'SUCCEEDED',
              output: ['https://cdn.runway.com/video.mp4'],
            }),
        });

      const result = await waitForCompletion('task-1', {
        pollIntervalMs: 10,
        maxWaitMs: 5000,
      });

      expect(result.status).toBe('SUCCEEDED');
      expect(result.output).toEqual(['https://cdn.runway.com/video.mp4']);
    });

    it('should return immediately on FAILED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'task-2',
            status: 'FAILED',
            failure: 'Content policy violation',
          }),
      });

      const result = await waitForCompletion('task-2', { pollIntervalMs: 10 });
      expect(result.status).toBe('FAILED');
      expect(result.failure).toBe('Content policy violation');
    });
  });

  describe('estimateCostCents', () => {
    it('should calculate cost based on duration', () => {
      expect(estimateCostCents(5)).toBe(50);
      expect(estimateCostCents(10)).toBe(100);
      expect(estimateCostCents(15)).toBe(150);
      expect(estimateCostCents(7)).toBe(70); // ceil(7/5 * 50) = 70
    });
  });

  describe('RunwayApiError', () => {
    it('should mark 429 and 5xx as retryable', () => {
      const err429 = new RunwayApiError('rate limit', 429, 'body');
      expect(err429.isRetryable).toBe(true);

      const err500 = new RunwayApiError('server error', 500, 'body');
      expect(err500.isRetryable).toBe(true);

      const err400 = new RunwayApiError('bad request', 400, 'body');
      expect(err400.isRetryable).toBe(false);
    });
  });
});
