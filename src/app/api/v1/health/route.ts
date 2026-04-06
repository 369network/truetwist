export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';

interface DependencyStatus {
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  error?: string;
}

async function checkDatabase(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'down', latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkRedis(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'down', latencyMs: Date.now() - start, error: String(err) };
  }
}

export async function GET() {
  const [db, redis] = await Promise.allSettled([checkDatabase(), checkRedis()]);

  const dependencies: Record<string, DependencyStatus> = {
    database: db.status === 'fulfilled' ? db.value : { status: 'down', error: String(db.reason) },
    redis: redis.status === 'fulfilled' ? redis.value : { status: 'down', error: String(redis.reason) },
  };

  const allHealthy = Object.values(dependencies).every((d) => d.status === 'ok');
  const anyDown = Object.values(dependencies).some((d) => d.status === 'down');

  const overallStatus = allHealthy ? 'ok' : anyDown ? 'degraded' : 'degraded';

  return NextResponse.json(
    {
      status: overallStatus,
      version: process.env.npm_package_version || '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies,
    },
    { status: allHealthy ? 200 : 503 },
  );
}
