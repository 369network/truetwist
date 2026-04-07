export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

const updateAccountSchema = z.object({
  accountName: z.string().min(1).optional(),
  status: z.enum(['active', 'paused', 'disconnected']).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getAuthUser(request);
    const { id } = await params;

    const account = await prisma.adAccount.findFirst({
      where: { id, userId: user.sub },
      include: {
        campaigns: { orderBy: { createdAt: 'desc' }, take: 50 },
        metrics: { orderBy: { date: 'desc' }, take: 30 },
      },
    });

    if (!account) throw Errors.notFound('Ad account');

    const { encryptedAccessToken, encryptedRefreshToken, ...safe } = account;
    return NextResponse.json({ data: safe });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getAuthUser(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    const existing = await prisma.adAccount.findFirst({ where: { id, userId: user.sub } });
    if (!existing) throw Errors.notFound('Ad account');

    const updated = await prisma.adAccount.update({
      where: { id },
      data: parsed.data,
    });

    await prisma.adAuditLog.create({
      data: {
        userId: user.sub,
        adAccountId: id,
        action: 'account_updated',
        entityType: 'ad_account',
        entityId: id,
        details: { changes: parsed.data },
      },
    });

    const { encryptedAccessToken, encryptedRefreshToken, ...safe } = updated;
    return NextResponse.json({ data: safe });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getAuthUser(request);
    const { id } = await params;

    const existing = await prisma.adAccount.findFirst({ where: { id, userId: user.sub } });
    if (!existing) throw Errors.notFound('Ad account');

    await prisma.adAccount.update({
      where: { id },
      data: { status: 'disconnected' },
    });

    await prisma.adAuditLog.create({
      data: {
        userId: user.sub,
        adAccountId: id,
        action: 'account_disconnected',
        entityType: 'ad_account',
        entityId: id,
      },
    });

    return NextResponse.json({ data: { id, status: 'disconnected' } });
  } catch (error) {
    return errorResponse(error);
  }
}
