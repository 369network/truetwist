import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export interface WaterfallTierInput {
  network: string;
  priority: number;
  floorCpm?: number;
  timeoutMs?: number;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface CreateWaterfallInput {
  userId: string;
  businessId: string;
  name: string;
  tiers: WaterfallTierInput[];
}

export interface WaterfallFillResult {
  filled: boolean;
  network: string | null;
  tier: number | null;
  adPayload: unknown | null;
  latencyMs: number;
  attemptedTiers: Array<{
    network: string;
    tier: number;
    result: 'filled' | 'no_fill' | 'timeout' | 'error';
    latencyMs: number;
  }>;
}

type AdRequestFn = (
  network: string,
  config: Record<string, unknown>
) => Promise<{ filled: boolean; payload: unknown }>;

export class AdWaterfallService {
  async createWaterfall(input: CreateWaterfallInput): Promise<string> {
    const waterfall = await prisma.adWaterfallConfig.create({
      data: {
        userId: input.userId,
        businessId: input.businessId,
        name: input.name,
        tiers: {
          create: input.tiers.map((t) => ({
            network: t.network,
            priority: t.priority,
            floorCpm: t.floorCpm ?? 0,
            timeoutMs: t.timeoutMs ?? 3000,
            enabled: t.enabled ?? true,
            config: (t.config ?? {}) as Prisma.InputJsonValue,
          })),
        },
      },
    });
    return waterfall.id;
  }

  async getWaterfall(waterfallId: string) {
    return prisma.adWaterfallConfig.findUnique({
      where: { id: waterfallId },
      include: { tiers: { orderBy: { priority: 'asc' } } },
    });
  }

  async listWaterfalls(userId: string, businessId: string) {
    return prisma.adWaterfallConfig.findMany({
      where: { userId, businessId },
      include: { tiers: { orderBy: { priority: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateWaterfall(
    waterfallId: string,
    updates: { name?: string; enabled?: boolean }
  ) {
    return prisma.adWaterfallConfig.update({
      where: { id: waterfallId },
      data: updates,
    });
  }

  async updateTier(
    tierId: string,
    updates: Partial<WaterfallTierInput>
  ) {
    const { config, ...rest } = updates;
    return prisma.adWaterfallTier.update({
      where: { id: tierId },
      data: {
        ...rest,
        ...(config !== undefined ? { config: config as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async deleteTier(tierId: string) {
    return prisma.adWaterfallTier.delete({ where: { id: tierId } });
  }

  async deleteWaterfall(waterfallId: string) {
    return prisma.adWaterfallConfig.delete({ where: { id: waterfallId } });
  }

  /**
   * Execute the waterfall: request ads from each tier in priority order.
   * Falls back to the next tier if the current one doesn't fill or times out.
   */
  async executeWaterfall(
    waterfallId: string,
    requestAd: AdRequestFn
  ): Promise<WaterfallFillResult> {
    const startTime = Date.now();
    const waterfall = await this.getWaterfall(waterfallId);

    if (!waterfall || !waterfall.enabled) {
      return {
        filled: false,
        network: null,
        tier: null,
        adPayload: null,
        latencyMs: Date.now() - startTime,
        attemptedTiers: [],
      };
    }

    const enabledTiers = waterfall.tiers.filter((t) => t.enabled);
    const attemptedTiers: WaterfallFillResult['attemptedTiers'] = [];

    for (const tier of enabledTiers) {
      const tierStart = Date.now();
      try {
        const result = await Promise.race([
          requestAd(tier.network, tier.config as Record<string, unknown>),
          new Promise<{ filled: false; payload: null }>((resolve) =>
            setTimeout(() => resolve({ filled: false, payload: null }), tier.timeoutMs)
          ),
        ]);

        const tierLatency = Date.now() - tierStart;

        if (result.filled) {
          attemptedTiers.push({
            network: tier.network,
            tier: tier.priority,
            result: 'filled',
            latencyMs: tierLatency,
          });
          return {
            filled: true,
            network: tier.network,
            tier: tier.priority,
            adPayload: result.payload,
            latencyMs: Date.now() - startTime,
            attemptedTiers,
          };
        }

        attemptedTiers.push({
          network: tier.network,
          tier: tier.priority,
          result: tierLatency >= tier.timeoutMs ? 'timeout' : 'no_fill',
          latencyMs: tierLatency,
        });
      } catch {
        attemptedTiers.push({
          network: tier.network,
          tier: tier.priority,
          result: 'error',
          latencyMs: Date.now() - tierStart,
        });
      }
    }

    return {
      filled: false,
      network: null,
      tier: null,
      adPayload: null,
      latencyMs: Date.now() - startTime,
      attemptedTiers,
    };
  }
}
