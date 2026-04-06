import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedis(): Redis {
  const instance = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: () => null, // don't retry during build
  });
  instance.on('error', () => {}); // suppress unhandled errors
  return instance;
}

let _redis: Redis | undefined;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = globalForRedis.redis ?? createRedis();
    if (process.env.NODE_ENV !== 'production') {
      globalForRedis.redis = _redis;
    }
  }
  return _redis;
}

// Backward-compatible default export — deferred via getter
export const redis = new Proxy({} as Redis, {
  get(_, prop) {
    const r = getRedis();
    const val = (r as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === 'function' ? val.bind(r) : val;
  },
});
