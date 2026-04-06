/**
 * Tests for GET /api/v1/health — health check endpoint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPrismaMock, parseResponse } from './helpers';

const prismaMock = createPrismaMock();
vi.mock('@/lib/prisma', () => ({ prisma: { ...prismaMock, $queryRaw: vi.fn() } }));
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => ({ ping: vi.fn().mockResolvedValue('PONG') })),
}));

const { GET } = await import('@/app/api/v1/health/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/health', () => {
  it('should return 200 when all dependencies are healthy', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ 1: 1 }]);

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.version).toBeTruthy();
    expect(body.dependencies.database.status).toBe('ok');
    expect(body.dependencies.redis.status).toBe('ok');
    expect(body.timestamp).toBeTruthy();
    expect(typeof body.uptime).toBe('number');
  });

  it('should return 503 when database is down', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection refused'));

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.dependencies.database.status).toBe('down');
    expect(body.dependencies.database.error).toContain('Connection refused');
  });

  it('should return 503 when redis is down', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ 1: 1 }]);

    const { getRedis } = await import('@/lib/redis');
    (getRedis as ReturnType<typeof vi.fn>).mockReturnValue({
      ping: vi.fn().mockRejectedValue(new Error('Redis timeout')),
    });

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.dependencies.redis.status).toBe('down');
  });
});
