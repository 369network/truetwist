import type { VideoTemplate } from '@/lib/ai/types';
import type { VideoProviderName } from './types';

// ============================================
// Template Mapping: Internal → Provider
// ============================================

interface ProviderTemplateMapping {
  providerId: string;
  avatarId?: string;
  voiceId?: string;
  scriptPrefix?: string;
}

// Maps our internal VideoTemplate IDs to provider-specific template/avatar configs.
// When a provider doesn't have a direct template match, we use a default
// avatar + script-prefix to style the output appropriately.
const SYNTHESIA_TEMPLATE_MAP: Record<string, ProviderTemplateMapping> = {
  'text-animation': {
    providerId: 'text-animation-default',
    scriptPrefix: 'Create a text animation with smooth transitions:',
  },
  'product-showcase': {
    providerId: 'product-showcase-default',
    avatarId: 'anna_costume1_cameraA',
    scriptPrefix: 'Present this product with enthusiasm:',
  },
  'talking-head': {
    providerId: 'talking-head-default',
    avatarId: 'anna_costume1_cameraA',
    scriptPrefix: '',
  },
  slideshow: {
    providerId: 'slideshow-default',
    scriptPrefix: 'Create a slideshow presentation:',
  },
  'before-after': {
    providerId: 'before-after-default',
    scriptPrefix: 'Show a before and after comparison:',
  },
  testimonial: {
    providerId: 'testimonial-default',
    avatarId: 'anna_costume1_cameraA',
    scriptPrefix: 'Deliver this testimonial naturally:',
  },
  'stat-reveal': {
    providerId: 'stat-reveal-default',
    scriptPrefix: 'Reveal these statistics with emphasis:',
  },
  'tip-carousel': {
    providerId: 'tip-carousel-default',
    avatarId: 'anna_costume1_cameraA',
    scriptPrefix: 'Present these tips one by one:',
  },
};

const HEYGEN_TEMPLATE_MAP: Record<string, ProviderTemplateMapping> = {
  'text-animation': {
    providerId: 'text-animation',
    scriptPrefix: 'Create a text animation video:',
  },
  'product-showcase': {
    providerId: 'product-showcase',
    avatarId: 'Daisy-inskirt-20220818',
    scriptPrefix: 'Showcase this product:',
  },
  'talking-head': {
    providerId: 'talking-head',
    avatarId: 'Daisy-inskirt-20220818',
    scriptPrefix: '',
  },
  slideshow: {
    providerId: 'slideshow',
    scriptPrefix: 'Present these slides:',
  },
  'before-after': {
    providerId: 'before-after',
    scriptPrefix: 'Compare the before and after:',
  },
  testimonial: {
    providerId: 'testimonial',
    avatarId: 'Daisy-inskirt-20220818',
    scriptPrefix: 'Share this testimonial:',
  },
  'stat-reveal': {
    providerId: 'stat-reveal',
    scriptPrefix: 'Reveal these key statistics:',
  },
  'tip-carousel': {
    providerId: 'tip-carousel',
    avatarId: 'Daisy-inskirt-20220818',
    scriptPrefix: 'Share these helpful tips:',
  },
};

const PROVIDER_MAPS: Record<string, Record<string, ProviderTemplateMapping>> = {
  synthesia: SYNTHESIA_TEMPLATE_MAP,
  heygen: HEYGEN_TEMPLATE_MAP,
};

export interface MappedTemplate {
  providerId: string;
  avatarId?: string;
  voiceId?: string;
  enrichedScript: string;
}

/**
 * Map an internal template + script to the provider-specific configuration.
 * If no mapping exists, returns the script as-is with no avatar/voice override.
 */
export function mapTemplate(
  provider: VideoProviderName,
  template: VideoTemplate | undefined,
  script: string
): MappedTemplate {
  if (!template) {
    return { providerId: '', enrichedScript: script };
  }

  const mapping = PROVIDER_MAPS[provider]?.[template];
  if (!mapping) {
    return { providerId: '', enrichedScript: script };
  }

  const enrichedScript = mapping.scriptPrefix
    ? `${mapping.scriptPrefix} ${script}`
    : script;

  return {
    providerId: mapping.providerId,
    avatarId: mapping.avatarId,
    voiceId: mapping.voiceId,
    enrichedScript,
  };
}

/**
 * Get all supported templates for a provider.
 */
export function getSupportedTemplates(
  provider: VideoProviderName
): VideoTemplate[] {
  const map = PROVIDER_MAPS[provider];
  if (!map) return [];
  return Object.keys(map) as VideoTemplate[];
}
