import { prisma } from '@/lib/prisma';

interface FrequencyConfigInput {
  userId: string;
  businessId: string;
  galleryType?: string;
  adEveryN?: number;
  maxAdsPerPage?: number;
  firstAdAfter?: number;
  adFreeForPremium?: boolean;
  adFreePlans?: string[];
}

export interface AdSlot {
  index: number;
  afterImageIndex: number;
}

export class AdFrequencyService {
  async upsertConfig(input: FrequencyConfigInput) {
    const galleryType = input.galleryType ?? 'default';

    return prisma.adFrequencyConfig.upsert({
      where: {
        userId_businessId_galleryType: {
          userId: input.userId,
          businessId: input.businessId,
          galleryType,
        },
      },
      create: {
        userId: input.userId,
        businessId: input.businessId,
        galleryType,
        adEveryN: input.adEveryN ?? 5,
        maxAdsPerPage: input.maxAdsPerPage ?? 3,
        firstAdAfter: input.firstAdAfter ?? 3,
        adFreeForPremium: input.adFreeForPremium ?? true,
        adFreePlans: input.adFreePlans ?? ['pro', 'enterprise'],
      },
      update: {
        ...(input.adEveryN !== undefined ? { adEveryN: input.adEveryN } : {}),
        ...(input.maxAdsPerPage !== undefined ? { maxAdsPerPage: input.maxAdsPerPage } : {}),
        ...(input.firstAdAfter !== undefined ? { firstAdAfter: input.firstAdAfter } : {}),
        ...(input.adFreeForPremium !== undefined ? { adFreeForPremium: input.adFreeForPremium } : {}),
        ...(input.adFreePlans !== undefined ? { adFreePlans: input.adFreePlans } : {}),
      },
    });
  }

  async getConfig(userId: string, businessId: string, galleryType = 'default') {
    return prisma.adFrequencyConfig.findUnique({
      where: {
        userId_businessId_galleryType: {
          userId,
          businessId,
          galleryType,
        },
      },
    });
  }

  async listConfigs(userId: string, businessId: string) {
    return prisma.adFrequencyConfig.findMany({
      where: { userId, businessId },
      orderBy: { galleryType: 'asc' },
    });
  }

  async deleteConfig(configId: string) {
    return prisma.adFrequencyConfig.delete({ where: { id: configId } });
  }

  /**
   * Calculate ad slot positions for a gallery with N images.
   * Returns the image indices after which an ad should be placed.
   */
  calculateAdSlots(
    totalImages: number,
    config: { adEveryN: number; maxAdsPerPage: number; firstAdAfter: number }
  ): AdSlot[] {
    const slots: AdSlot[] = [];
    let adCount = 0;
    let nextSlot = config.firstAdAfter;

    while (nextSlot < totalImages && adCount < config.maxAdsPerPage) {
      slots.push({ index: adCount, afterImageIndex: nextSlot });
      adCount++;
      nextSlot += config.adEveryN;
    }

    return slots;
  }

  /**
   * Determine if ads should be shown to a user based on their plan.
   */
  shouldShowAds(
    userPlan: string,
    config: { adFreeForPremium: boolean; adFreePlans: unknown }
  ): boolean {
    if (!config.adFreeForPremium) return true;
    const plans = Array.isArray(config.adFreePlans) ? config.adFreePlans : [];
    return !plans.includes(userPlan);
  }

  /**
   * Get the full ad placement decision for a gallery view.
   * Combines frequency config with user plan check.
   */
  async getAdPlacements(
    userId: string,
    businessId: string,
    galleryType: string,
    totalImages: number,
    viewerPlan: string
  ): Promise<{ showAds: boolean; slots: AdSlot[] }> {
    const config = await this.getConfig(userId, businessId, galleryType);

    if (!config || !config.enabled) {
      return { showAds: false, slots: [] };
    }

    if (!this.shouldShowAds(viewerPlan, config)) {
      return { showAds: false, slots: [] };
    }

    const slots = this.calculateAdSlots(totalImages, config);
    return { showAds: true, slots };
  }
}
