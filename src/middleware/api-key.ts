import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/errors';
import { checkRateLimit } from '@/middleware/rate-limit';

export interface ApiKeyPayload {
  sub: string; // userId
  keyId: string;
  scope: string; // read, write, admin
  plan: string;
}

const API_KEY_RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  free: { max: 0, windowMs: 3600000 }, // free plan cannot use API keys
  starter: { max: 100, windowMs: 3600000 }, // 100 req/hr
  pro: { max: 1000, windowMs: 3600000 }, // 1000 req/hr
  enterprise: { max: 5000, windowMs: 3600000 }, // 5000 req/hr
};

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function getApiKeyUser(request: NextRequest): Promise<ApiKeyPayload> {
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  const rawKey = apiKeyHeader || (authHeader?.startsWith('Bearer tt_') ? authHeader.slice(7) : null);

  if (!rawKey || !rawKey.startsWith('tt_')) {
    throw Errors.unauthorized('Missing or invalid API key. Keys start with tt_');
  }

  const keyHash = hashApiKey(rawKey);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { id: true, plan: true, email: true } } },
  });

  if (!apiKey) {
    throw Errors.unauthorized('Invalid API key');
  }

  if (apiKey.status === 'revoked') {
    throw Errors.unauthorized('API key has been revoked');
  }

  if (apiKey.status === 'expired' || (apiKey.expiresAt && apiKey.expiresAt < new Date())) {
    throw Errors.unauthorized('API key has expired');
  }

  // Check rotation grace period — allow old key during grace
  if (apiKey.rotatedFromId && apiKey.rotationGraceEndsAt && apiKey.rotationGraceEndsAt < new Date()) {
    throw Errors.unauthorized('API key rotation grace period has ended');
  }

  const plan = apiKey.user.plan;
  const limits = API_KEY_RATE_LIMITS[plan] || API_KEY_RATE_LIMITS.starter;

  if (limits.max === 0) {
    throw Errors.forbidden('API key access requires a paid plan (Starter or above)');
  }

  // Rate limit per API key
  await checkRateLimit(`api_key:${apiKey.id}`, limits);

  // Update usage stats (fire-and-forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date(), requestCount: { increment: 1 } },
  }).catch(() => {});

  return {
    sub: apiKey.userId,
    keyId: apiKey.id,
    scope: apiKey.scope,
    plan,
  };
}

export function requireScope(payload: ApiKeyPayload, requiredScope: 'read' | 'write' | 'admin'): void {
  const scopeLevel: Record<string, number> = { read: 1, write: 2, admin: 3 };
  const userLevel = scopeLevel[payload.scope] || 0;
  const requiredLevel = scopeLevel[requiredScope] || 0;

  if (userLevel < requiredLevel) {
    throw Errors.forbidden(`This action requires '${requiredScope}' scope. Your key has '${payload.scope}' scope.`);
  }
}
