export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
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

// GET /api/v1/developer/api-keys/:keyId - Get key details
export async function GET(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const user = getAuthUser(request);

    const apiKey = await prisma.apiKey.findFirst({
      where: { id: params.keyId, userId: user.sub },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scope: true,
        status: true,
        expiresAt: true,
        lastUsedAt: true,
        requestCount: true,
        rotatedFromId: true,
        rotationGraceEndsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!apiKey) {
      throw Errors.notFound('API key');
    }

    return NextResponse.json({ data: apiKey });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/developer/api-keys/:keyId - Update key name or revoke
export async function PATCH(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();

    const existing = await prisma.apiKey.findFirst({
      where: { id: params.keyId, userId: user.sub },
    });

    if (!existing) {
      throw Errors.notFound('API key');
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 100) {
        throw Errors.validation({ name: 'Name must be 1-100 characters' });
      }
      updateData.name = body.name;
    }

    if (body.status === 'revoked') {
      updateData.status = 'revoked';
      updateData.revokedAt = new Date();
    }

    const updated = await prisma.apiKey.update({
      where: { id: params.keyId },
      data: updateData,
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
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/developer/api-keys/:keyId - Revoke a key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const user = getAuthUser(request);

    const existing = await prisma.apiKey.findFirst({
      where: { id: params.keyId, userId: user.sub },
    });

    if (!existing) {
      throw Errors.notFound('API key');
    }

    await prisma.apiKey.update({
      where: { id: params.keyId },
      data: { status: 'revoked', revokedAt: new Date() },
    });

    return NextResponse.json({ message: 'API key revoked successfully' });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/developer/api-keys/:keyId - Rotate a key (create new, grace period for old)
export async function POST(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json().catch(() => ({}));

    const gracePeriodHours = body.gracePeriodHours || 24;

    const existing = await prisma.apiKey.findFirst({
      where: { id: params.keyId, userId: user.sub, status: 'active' },
    });

    if (!existing) {
      throw Errors.notFound('Active API key');
    }

    const newRawKey = generateApiKey();
    const newKeyHash = hashKey(newRawKey);
    const newKeyPrefix = newRawKey.slice(0, 11);
    const graceEndsAt = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000);

    const [newKey] = await prisma.$transaction([
      prisma.apiKey.create({
        data: {
          userId: user.sub,
          name: `${existing.name} (rotated)`,
          keyPrefix: newKeyPrefix,
          keyHash: newKeyHash,
          scope: existing.scope,
          expiresAt: existing.expiresAt,
          rotatedFromId: existing.id,
          rotationGraceEndsAt: graceEndsAt,
        },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scope: true,
          status: true,
          expiresAt: true,
          rotationGraceEndsAt: true,
          createdAt: true,
        },
      }),
      // Old key gets a grace period, then auto-expires
      prisma.apiKey.update({
        where: { id: existing.id },
        data: { expiresAt: graceEndsAt },
      }),
    ]);

    return NextResponse.json({
      data: {
        ...newKey,
        key: newRawKey,
      },
      message: `New key created. Old key remains valid until ${graceEndsAt.toISOString()}.`,
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
