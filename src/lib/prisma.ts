import { PrismaClient } from '@prisma/client';
import { createLogger } from '@/lib/logger';

const dbLogger = createLogger('prisma');

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'error' },
    ],
  });

  // Query timing & slow query detection
  const SLOW_QUERY_THRESHOLD_MS = 200;

  client.$on('query', (e: any) => {
    const duration = e.duration;
    if (duration >= SLOW_QUERY_THRESHOLD_MS) {
      dbLogger.warn('Slow query detected', {
        query: e.query?.slice(0, 500),
        params: e.params?.slice(0, 200),
        duration,
        target: e.target,
      });
    } else {
      dbLogger.debug('Query executed', {
        duration,
        target: e.target,
      });
    }
  });

  client.$on('warn', (e: any) => {
    dbLogger.warn('Prisma warning', { message: e.message });
  });

  client.$on('error', (e: any) => {
    dbLogger.error('Prisma error', { message: e.message, target: e.target });
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
