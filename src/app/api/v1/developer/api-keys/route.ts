import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

function generateApiKey(): string {
  const random = crypto.randomBytes(32).toString('hex');
  return `tt_${random}`;
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// GET /api/v1/developer/api-keys - List user's API keys
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);

    const keys = await prisma.apiKey.findMany({
      where: { userId: user.sub },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scope: true,
        status: true,
        expiresAt: true,
        lastUsedAt: true,
        requestCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: keys });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/developer/api-keys - Create a new API key
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    const { name, scope = 'read', expiresInDays } = body;

    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 100) {
      throw Errors.validation({ name: 'Name is required (1-100 characters)' });
    }

    if (!['read', 'write', 'admin'].includes(scope)) {
      throw Errors.validation({ scope: 'Scope must be read, write, or admin' });
    }

    // Limit to 10 active keys per user
    const activeCount = await prisma.apiKey.count({
      where: { userId: user.sub, status: 'active' },
    });

    if (activeCount >= 10) {
      throw Errors.badRequest('Maximum of 10 active API keys allowed. Revoke unused keys first.');
    }

    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 11); // tt_ + 8 chars

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.sub,
        name,
        keyPrefix,
        keyHash,
        scope,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scope: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Return the raw key ONLY on creation - it cannot be retrieved again
    return NextResponse.json({
      data: {
        ...apiKey,
        key: rawKey,
      },
      message: 'Store this key securely. It will not be shown again.',
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
