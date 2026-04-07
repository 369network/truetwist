export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createAccountSchema = z.object({
  platform: z.enum(['meta', 'google', 'tiktok']),
  platformAccountId: z.string().min(1),
  accountName: z.string().min(1),
  businessId: z.string().uuid().optional(),
  currency: z.string().length(3).default('USD'),
  timezone: z.string().default('UTC'),
});

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

    const where: Record<string, unknown> = { userId: user.sub };
    if (platform) where.platform = platform;
    if (status) where.status = status;

    const [accounts, total] = await Promise.all([
      prisma.adAccount.findMany({
        where,
        include: { _count: { select: { campaigns: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adAccount.count({ where }),
    ]);

    return NextResponse.json({
      data: accounts.map(({ encryptedAccessToken, encryptedRefreshToken, ...a }) => a),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const parsed = createAccountSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    const account = await prisma.adAccount.create({
      data: {
        userId: user.sub,
        platform: parsed.data.platform,
        platformAccountId: parsed.data.platformAccountId,
        accountName: parsed.data.accountName,
        businessId: parsed.data.businessId,
        currency: parsed.data.currency,
        timezone: parsed.data.timezone,
      },
    });

    await prisma.adAuditLog.create({
      data: {
        userId: user.sub,
        adAccountId: account.id,
        action: 'account_created',
        entityType: 'ad_account',
        entityId: account.id,
        details: { platform: account.platform },
      },
    });

    const { encryptedAccessToken, encryptedRefreshToken, ...safe } = account;
    return NextResponse.json({ data: safe }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
