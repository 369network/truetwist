import { prisma } from '@/lib/prisma';
import type { PlanTier } from '@/types';
import { PLAN_CONFIGS } from './config';

export interface UsageSummary {
  plan: PlanTier;
  socialAccounts: { used: number; limit: number };
  scheduledPosts: { used: number; limit: number };
  teamMembers: { used: number; limit: number };
  apiCalls: { used: number; limit: number };
  period: { start: Date; end: Date };
}

function getCurrentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { plan: true },
  });

  const plan = user.plan as PlanTier;
  const config = PLAN_CONFIGS[plan] ?? PLAN_CONFIGS.free;
  const period = getCurrentPeriod();

  // Count current usage across entities
  const [socialAccountCount, scheduledPostCount, teamMemberCount] = await Promise.all([
    prisma.socialAccount.count({ where: { userId } }),
    prisma.postSchedule.count({
      where: {
        post: { userId },
        status: 'pending',
      },
    }),
    // Count team members across all teams the user owns
    prisma.teamMember.count({
      where: {
        team: { ownerId: userId },
      },
    }),
  ]);

  return {
    plan,
    socialAccounts: {
      used: socialAccountCount,
      limit: config.features.maxSocialAccounts,
    },
    scheduledPosts: {
      used: scheduledPostCount,
      limit: config.features.maxScheduledPosts,
    },
    teamMembers: {
      used: teamMemberCount,
      limit: config.features.maxTeamMembers,
    },
    apiCalls: {
      used: 0, // TODO: integrate API call tracking when rate-limit middleware logs counts
      limit: -1,
    },
    period,
  };
}

export async function checkFeatureAccess(
  userId: string,
  feature: keyof typeof PLAN_CONFIGS.free.features
): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { plan: true },
  });

  const plan = user.plan as PlanTier;
  const config = PLAN_CONFIGS[plan] ?? PLAN_CONFIGS.free;
  return !!config.features[feature];
}

export async function checkResourceLimit(
  userId: string,
  resource: 'socialAccounts' | 'scheduledPosts' | 'teamMembers'
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const summary = await getUsageSummary(userId);
  const usage = summary[resource];

  if (usage.limit === -1) {
    return { allowed: true, used: usage.used, limit: usage.limit };
  }

  return {
    allowed: usage.used < usage.limit,
    used: usage.used,
    limit: usage.limit,
  };
}
