import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type RevenueEventType = 'impression' | 'click' | 'viewable_impression' | 'conversion';

interface RecordEventInput {
  userId: string;
  businessId: string;
  network: string;
  eventType: RevenueEventType;
  revenueCents?: number;
  cpm?: number;
  position?: string;
  waterfallTier?: number;
  positionTestId?: string;
  variantId?: string;
  metadata?: Record<string, unknown>;
}

export interface RevenueSummary {
  totalRevenueCents: number;
  totalImpressions: number;
  totalClicks: number;
  totalViewableImpressions: number;
  totalConversions: number;
  effectiveCpm: number;
  ctr: number;
  viewabilityRate: number;
  byNetwork: Record<string, {
    revenueCents: number;
    impressions: number;
    clicks: number;
    effectiveCpm: number;
  }>;
  byPosition: Record<string, {
    revenueCents: number;
    impressions: number;
    clicks: number;
  }>;
}

export interface DailyRevenue {
  date: string;
  revenueCents: number;
  impressions: number;
  clicks: number;
}

export class AdRevenueService {
  async recordEvent(input: RecordEventInput): Promise<string> {
    const event = await prisma.adRevenueEvent.create({
      data: {
        userId: input.userId,
        businessId: input.businessId,
        network: input.network,
        eventType: input.eventType,
        revenueCents: input.revenueCents ?? 0,
        cpm: input.cpm ?? 0,
        position: input.position,
        waterfallTier: input.waterfallTier,
        positionTestId: input.positionTestId,
        variantId: input.variantId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return event.id;
  }

  async recordBatch(events: RecordEventInput[]): Promise<number> {
    const result = await prisma.adRevenueEvent.createMany({
      data: events.map((e) => ({
        userId: e.userId,
        businessId: e.businessId,
        network: e.network,
        eventType: e.eventType,
        revenueCents: e.revenueCents ?? 0,
        cpm: e.cpm ?? 0,
        position: e.position,
        waterfallTier: e.waterfallTier,
        positionTestId: e.positionTestId,
        variantId: e.variantId,
        metadata: (e.metadata ?? {}) as Prisma.InputJsonValue,
      })),
    });
    return result.count;
  }

  async getRevenueSummary(
    userId: string,
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueSummary> {
    const events = await prisma.adRevenueEvent.findMany({
      where: {
        userId,
        businessId,
        occurredAt: { gte: startDate, lte: endDate },
      },
    });

    let totalRevenueCents = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalViewableImpressions = 0;
    let totalConversions = 0;
    const byNetwork: RevenueSummary['byNetwork'] = {};
    const byPosition: RevenueSummary['byPosition'] = {};

    for (const event of events) {
      totalRevenueCents += event.revenueCents;

      if (event.eventType === 'impression') totalImpressions++;
      if (event.eventType === 'click') totalClicks++;
      if (event.eventType === 'viewable_impression') totalViewableImpressions++;
      if (event.eventType === 'conversion') totalConversions++;

      // Aggregate by network
      if (!byNetwork[event.network]) {
        byNetwork[event.network] = { revenueCents: 0, impressions: 0, clicks: 0, effectiveCpm: 0 };
      }
      byNetwork[event.network].revenueCents += event.revenueCents;
      if (event.eventType === 'impression') byNetwork[event.network].impressions++;
      if (event.eventType === 'click') byNetwork[event.network].clicks++;

      // Aggregate by position
      if (event.position) {
        if (!byPosition[event.position]) {
          byPosition[event.position] = { revenueCents: 0, impressions: 0, clicks: 0 };
        }
        byPosition[event.position].revenueCents += event.revenueCents;
        if (event.eventType === 'impression') byPosition[event.position].impressions++;
        if (event.eventType === 'click') byPosition[event.position].clicks++;
      }
    }

    // Calculate eCPM per network
    for (const net of Object.values(byNetwork)) {
      net.effectiveCpm = net.impressions > 0 ? (net.revenueCents / net.impressions) * 10 : 0;
    }

    return {
      totalRevenueCents,
      totalImpressions,
      totalClicks,
      totalViewableImpressions,
      totalConversions,
      effectiveCpm: totalImpressions > 0 ? (totalRevenueCents / totalImpressions) * 10 : 0,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      viewabilityRate: totalImpressions > 0 ? totalViewableImpressions / totalImpressions : 0,
      byNetwork,
      byPosition,
    };
  }

  async getDailyRevenue(
    userId: string,
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DailyRevenue[]> {
    const events = await prisma.adRevenueEvent.findMany({
      where: {
        userId,
        businessId,
        occurredAt: { gte: startDate, lte: endDate },
      },
      orderBy: { occurredAt: 'asc' },
    });

    const dailyMap = new Map<string, DailyRevenue>();

    for (const event of events) {
      const dateKey = event.occurredAt.toISOString().slice(0, 10);
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, revenueCents: 0, impressions: 0, clicks: 0 });
      }
      const day = dailyMap.get(dateKey)!;
      day.revenueCents += event.revenueCents;
      if (event.eventType === 'impression') day.impressions++;
      if (event.eventType === 'click') day.clicks++;
    }

    return Array.from(dailyMap.values());
  }

  async getNetworkComparison(
    userId: string,
    businessId: string,
    startDate: Date,
    endDate: Date
  ) {
    const summary = await this.getRevenueSummary(userId, businessId, startDate, endDate);
    return Object.entries(summary.byNetwork)
      .map(([network, data]) => ({
        network,
        ...data,
        ctr: data.impressions > 0 ? data.clicks / data.impressions : 0,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents);
  }
}
