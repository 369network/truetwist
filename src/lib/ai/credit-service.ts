import { prisma } from '@/lib/prisma';
import type {
  GenerationType,
  PlanCredits,
  CreditUsage,
  UserCredits,
} from './types';
import { PLAN_CREDITS } from './types';

function getCurrentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getCreditKey(type: GenerationType): keyof PlanCredits {
  switch (type) {
    case 'text':
      return 'textGenerations';
    case 'image':
      return 'imageGenerations';
    case 'video':
      return 'videoGenerations';
  }
}

export async function getUserCredits(userId: string): Promise<UserCredits> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { plan: true },
  });

  const planCredits = PLAN_CREDITS[user.plan] ?? PLAN_CREDITS.free;
  const { start, end } = getCurrentPeriod();

  const usage = await prisma.aiGeneration.groupBy({
    by: ['generationType'],
    where: {
      userId,
      createdAt: { gte: start, lte: end },
    },
    _count: { id: true },
  });

  const usageMap = new Map(
    usage.map((u) => [u.generationType, u._count.id])
  );

  function buildUsage(type: GenerationType): CreditUsage {
    const used = usageMap.get(type) ?? 0;
    const limit = planCredits[getCreditKey(type)];
    return {
      used,
      limit,
      remaining: limit === -1 ? -1 : Math.max(0, limit - used),
    };
  }

  return {
    text: buildUsage('text'),
    image: buildUsage('image'),
    video: buildUsage('video'),
    periodStart: start,
    periodEnd: end,
  };
}

export async function checkCredits(
  userId: string,
  type: GenerationType
): Promise<{ allowed: boolean; remaining: number }> {
  const credits = await getUserCredits(userId);
  const usage = credits[type];

  if (usage.limit === -1) {
    return { allowed: true, remaining: -1 };
  }

  return {
    allowed: usage.remaining > 0,
    remaining: usage.remaining,
  };
}

export async function recordGeneration(params: {
  userId: string;
  type: GenerationType;
  prompt: string;
  model: string;
  outputText?: string;
  outputMediaUrl?: string;
  tokensInput?: number;
  tokensOutput?: number;
  costCents: number;
  durationMs: number;
}): Promise<string> {
  const record = await prisma.aiGeneration.create({
    data: {
      userId: params.userId,
      generationType: params.type,
      prompt: params.prompt,
      modelUsed: params.model,
      outputText: params.outputText,
      outputMediaUrl: params.outputMediaUrl,
      tokensInput: params.tokensInput ?? 0,
      tokensOutput: params.tokensOutput ?? 0,
      costCents: params.costCents,
      durationMs: params.durationMs,
    },
  });

  return record.id;
}

export async function getGenerationHistory(
  userId: string,
  options: {
    type?: GenerationType;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { type, limit = 20, offset = 0 } = options;

  const [records, total] = await Promise.all([
    prisma.aiGeneration.findMany({
      where: {
        userId,
        ...(type ? { generationType: type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.aiGeneration.count({
      where: {
        userId,
        ...(type ? { generationType: type } : {}),
      },
    }),
  ]);

  return { records, total };
}

export async function getMonthlySpend(userId: string): Promise<number> {
  const { start, end } = getCurrentPeriod();

  const result = await prisma.aiGeneration.aggregate({
    where: {
      userId,
      createdAt: { gte: start, lte: end },
    },
    _sum: { costCents: true },
  });

  return result._sum.costCents ?? 0;
}
