import type { BrandContext, VideoAspectRatio } from './types';
import type { Platform } from '@/lib/social/types';

// ============================================
// Template-Based Video Generation System
// ============================================

export type VideoTemplateId =
  | 'text-animation'
  | 'product-showcase'
  | 'before-after'
  | 'testimonial'
  | 'stat-reveal'
  | 'tip-carousel'
  | 'talking-head'
  | 'slideshow';

export interface VideoTemplateDefinition {
  id: VideoTemplateId;
  name: string;
  description: string;
  category: 'animation' | 'product' | 'social-proof' | 'educational';
  defaultDurationSeconds: number;
  supportedDurations: number[];
  supportedAspectRatios: VideoAspectRatio[];
  requiredFields: string[];
  optionalFields: string[];
  sceneCount: { min: number; max: number };
}

export interface TemplateScene {
  sceneNumber: number;
  durationSeconds: number;
  visualDescription: string;
  textOverlay?: string;
  transition: 'cut' | 'fade' | 'slide' | 'zoom' | 'dissolve' | 'wipe';
  animation?: string;
}

export interface TemplateRenderRequest {
  templateId: VideoTemplateId;
  platform: Platform;
  aspectRatio: VideoAspectRatio;
  durationSeconds: number;
  brand: BrandContext;
  content: {
    headline?: string;
    bodyText?: string;
    stats?: Array<{ label: string; value: string }>;
    testimonialQuote?: string;
    testimonialAuthor?: string;
    beforeDescription?: string;
    afterDescription?: string;
    tips?: string[];
    productName?: string;
    productDescription?: string;
    callToAction?: string;
    images?: string[];
  };
}

export interface TemplateRenderResult {
  prompt: string;
  scenes: TemplateScene[];
  voiceoverScript: string;
  musicMood: string;
}

// ============================================
// Template Definitions (8 templates)
// ============================================

export const VIDEO_TEMPLATES: Record<VideoTemplateId, VideoTemplateDefinition> = {
  'text-animation': {
    id: 'text-animation',
    name: 'Text Animation',
    description: 'Smooth text slide animations with motion graphics, quote graphics, and stat reveals',
    category: 'animation',
    defaultDurationSeconds: 10,
    supportedDurations: [5, 10, 15, 30],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    requiredFields: ['headline'],
    optionalFields: ['bodyText', 'callToAction'],
    sceneCount: { min: 2, max: 6 },
  },
  'product-showcase': {
    id: 'product-showcase',
    name: 'Product Showcase',
    description: 'Cinematic product demonstrations with camera movement and image-to-video transitions',
    category: 'product',
    defaultDurationSeconds: 15,
    supportedDurations: [10, 15, 30],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    requiredFields: ['productName'],
    optionalFields: ['productDescription', 'callToAction', 'images'],
    sceneCount: { min: 3, max: 8 },
  },
  'before-after': {
    id: 'before-after',
    name: 'Before & After',
    description: 'Split-screen comparison template showing transformation or improvement',
    category: 'social-proof',
    defaultDurationSeconds: 10,
    supportedDurations: [10, 15],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    requiredFields: ['beforeDescription', 'afterDescription'],
    optionalFields: ['headline', 'callToAction'],
    sceneCount: { min: 3, max: 5 },
  },
  testimonial: {
    id: 'testimonial',
    name: 'Testimonial',
    description: 'Customer testimonial template with text overlay and professional styling',
    category: 'social-proof',
    defaultDurationSeconds: 10,
    supportedDurations: [10, 15, 30],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    requiredFields: ['testimonialQuote', 'testimonialAuthor'],
    optionalFields: ['headline', 'callToAction'],
    sceneCount: { min: 3, max: 5 },
  },
  'stat-reveal': {
    id: 'stat-reveal',
    name: 'Stat Reveal',
    description: 'Animated statistics and data visualizations with counting animations',
    category: 'animation',
    defaultDurationSeconds: 10,
    supportedDurations: [5, 10, 15],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    requiredFields: ['stats'],
    optionalFields: ['headline', 'callToAction'],
    sceneCount: { min: 2, max: 6 },
  },
  'tip-carousel': {
    id: 'tip-carousel',
    name: 'Tip Carousel',
    description: 'Educational tips presented as a dynamic carousel with numbered slides',
    category: 'educational',
    defaultDurationSeconds: 15,
    supportedDurations: [10, 15, 30],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    requiredFields: ['tips'],
    optionalFields: ['headline', 'callToAction'],
    sceneCount: { min: 3, max: 8 },
  },
  'talking-head': {
    id: 'talking-head',
    name: 'Talking Head',
    description: 'Professional talking-head content for tips, announcements, or advice',
    category: 'educational',
    defaultDurationSeconds: 15,
    supportedDurations: [10, 15, 30],
    supportedAspectRatios: ['9:16', '16:9'],
    requiredFields: ['bodyText'],
    optionalFields: ['headline', 'callToAction'],
    sceneCount: { min: 3, max: 6 },
  },
  slideshow: {
    id: 'slideshow',
    name: 'Slideshow',
    description: 'Polished slideshow with smooth transitions between scenes for storytelling',
    category: 'animation',
    defaultDurationSeconds: 15,
    supportedDurations: [10, 15, 30],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    requiredFields: ['bodyText'],
    optionalFields: ['headline', 'callToAction', 'images'],
    sceneCount: { min: 3, max: 10 },
  },
};

/**
 * List all available video templates.
 */
export function listTemplates(): VideoTemplateDefinition[] {
  return Object.values(VIDEO_TEMPLATES);
}

/**
 * Get a template definition by ID.
 */
export function getTemplate(id: VideoTemplateId): VideoTemplateDefinition | undefined {
  return VIDEO_TEMPLATES[id];
}

/**
 * Render a template into a Runway-ready prompt and scene breakdown.
 */
export function renderTemplate(req: TemplateRenderRequest): TemplateRenderResult {
  const template = VIDEO_TEMPLATES[req.templateId];
  if (!template) {
    throw new Error(`Unknown template: ${req.templateId}`);
  }

  const renderer = TEMPLATE_RENDERERS[req.templateId];
  return renderer(req, template);
}

// ============================================
// Template Renderers
// ============================================

type TemplateRenderer = (
  req: TemplateRenderRequest,
  def: VideoTemplateDefinition
) => TemplateRenderResult;

const TEMPLATE_RENDERERS: Record<VideoTemplateId, TemplateRenderer> = {
  'text-animation': renderTextAnimation,
  'product-showcase': renderProductShowcase,
  'before-after': renderBeforeAfter,
  testimonial: renderTestimonial,
  'stat-reveal': renderStatReveal,
  'tip-carousel': renderTipCarousel,
  'talking-head': renderTalkingHead,
  slideshow: renderSlideshow,
};

function brandColorString(brand: BrandContext): string {
  if (!brand.colors) return '';
  return `Brand colors: ${brand.colors.primary} (primary), ${brand.colors.secondary} (secondary), ${brand.colors.accent} (accent).`;
}

function renderTextAnimation(req: TemplateRenderRequest, def: VideoTemplateDefinition): TemplateRenderResult {
  const { brand, content, durationSeconds } = req;
  const scenes: TemplateScene[] = [];
  const sceneDuration = Math.floor(durationSeconds / 3);

  scenes.push({
    sceneNumber: 1,
    durationSeconds: sceneDuration,
    visualDescription: `Smooth text reveal animation on a clean background with ${brand.businessName} branding. Kinetic typography brings the headline to life.`,
    textOverlay: content.headline ?? brand.businessName,
    transition: 'fade',
    animation: 'text-reveal-slide-up',
  });

  if (content.bodyText) {
    scenes.push({
      sceneNumber: 2,
      durationSeconds: sceneDuration,
      visualDescription: `Supporting text appears with fluid motion graphics. Professional, modern design aesthetic.`,
      textOverlay: content.bodyText,
      transition: 'slide',
      animation: 'text-typewriter',
    });
  }

  scenes.push({
    sceneNumber: scenes.length + 1,
    durationSeconds: durationSeconds - scenes.reduce((s, sc) => s + sc.durationSeconds, 0),
    visualDescription: `Bold call-to-action with ${brand.businessName} logo. Energetic closing animation.`,
    textOverlay: content.callToAction ?? `Follow ${brand.businessName}`,
    transition: 'zoom',
    animation: 'bounce-in',
  });

  return {
    prompt: `Create a ${durationSeconds}-second text animation video for ${brand.businessName}. ${brandColorString(brand)} Professional motion graphics with smooth text transitions. Headline: "${content.headline}". ${content.bodyText ? `Body: "${content.bodyText}".` : ''} Platform: ${req.platform}, aspect ratio: ${req.aspectRatio}.`,
    scenes,
    voiceoverScript: content.bodyText || content.headline || '',
    musicMood: 'upbeat modern',
  };
}

function renderProductShowcase(req: TemplateRenderRequest, def: VideoTemplateDefinition): TemplateRenderResult {
  const { brand, content, durationSeconds } = req;
  const sceneDuration = Math.floor(durationSeconds / 4);

  const scenes: TemplateScene[] = [
    {
      sceneNumber: 1,
      durationSeconds: sceneDuration,
      visualDescription: `Cinematic opening shot with slow reveal of ${content.productName || 'the product'}. Professional lighting, clean background.`,
      textOverlay: content.productName,
      transition: 'fade',
      animation: 'zoom-in-slow',
    },
    {
      sceneNumber: 2,
      durationSeconds: sceneDuration,
      visualDescription: `Close-up details and features of ${content.productName}. Dynamic camera orbit showing craftsmanship and design.`,
      transition: 'dissolve',
      animation: 'camera-orbit',
    },
    {
      sceneNumber: 3,
      durationSeconds: sceneDuration,
      visualDescription: `${content.productDescription || 'Product in use'} — lifestyle context showing the product solving a real problem.`,
      textOverlay: content.productDescription,
      transition: 'slide',
    },
    {
      sceneNumber: 4,
      durationSeconds: durationSeconds - sceneDuration * 3,
      visualDescription: `${brand.businessName} logo with call-to-action. Premium closing sequence.`,
      textOverlay: content.callToAction ?? `Shop now at ${brand.businessName}`,
      transition: 'fade',
      animation: 'logo-reveal',
    },
  ];

  return {
    prompt: `Create a ${durationSeconds}-second cinematic product showcase video for "${content.productName}" by ${brand.businessName}. ${brandColorString(brand)} Dynamic camera angles, professional lighting, premium feel. ${content.productDescription || ''}. Platform: ${req.platform}.`,
    scenes,
    voiceoverScript: `Introducing ${content.productName}. ${content.productDescription || ''} ${content.callToAction || ''}`,
    musicMood: 'cinematic elegant',
  };
}

function renderBeforeAfter(req: TemplateRenderRequest, def: VideoTemplateDefinition): TemplateRenderResult {
  const { brand, content, durationSeconds } = req;
  const thirdDuration = Math.floor(durationSeconds / 3);

  const scenes: TemplateScene[] = [
    {
      sceneNumber: 1,
      durationSeconds: thirdDuration,
      visualDescription: `"BEFORE" label with visual showing the problem state. ${content.beforeDescription}. Muted, desaturated color grading.`,
      textOverlay: `BEFORE: ${content.beforeDescription}`,
      transition: 'wipe',
      animation: 'split-screen-left',
    },
    {
      sceneNumber: 2,
      durationSeconds: thirdDuration,
      visualDescription: `Dynamic wipe transition to "AFTER" state. ${content.afterDescription}. Vibrant, bright color grading showing improvement.`,
      textOverlay: `AFTER: ${content.afterDescription}`,
      transition: 'wipe',
      animation: 'split-screen-right',
    },
    {
      sceneNumber: 3,
      durationSeconds: durationSeconds - thirdDuration * 2,
      visualDescription: `Side-by-side comparison with ${brand.businessName} branding. Clear visual proof of the transformation.`,
      textOverlay: content.callToAction ?? `Transform with ${brand.businessName}`,
      transition: 'fade',
      animation: 'side-by-side-reveal',
    },
  ];

  return {
    prompt: `Create a ${durationSeconds}-second before/after comparison video for ${brand.businessName}. Before: ${content.beforeDescription}. After: ${content.afterDescription}. ${brandColorString(brand)} Dynamic split-screen wipe transition. Platform: ${req.platform}.`,
    scenes,
    voiceoverScript: `Before: ${content.beforeDescription}. After: ${content.afterDescription}. ${content.callToAction || ''}`,
    musicMood: 'transformative uplifting',
  };
}

function renderTestimonial(req: TemplateRenderRequest, def: VideoTemplateDefinition): TemplateRenderResult {
  const { brand, content, durationSeconds } = req;
  const sceneDuration = Math.floor(durationSeconds / 3);

  const scenes: TemplateScene[] = [
    {
      sceneNumber: 1,
      durationSeconds: sceneDuration,
      visualDescription: `Opening quotation marks appear. Clean, professional background with subtle brand accents. Warm, inviting atmosphere.`,
      textOverlay: `"${content.testimonialQuote}"`,
      transition: 'fade',
      animation: 'quote-reveal',
    },
    {
      sceneNumber: 2,
      durationSeconds: sceneDuration,
      visualDescription: `Testimonial text elegantly displayed in large, readable font. Subtle background animation.`,
      textOverlay: content.testimonialQuote,
      transition: 'dissolve',
      animation: 'text-float',
    },
    {
      sceneNumber: 3,
      durationSeconds: durationSeconds - sceneDuration * 2,
      visualDescription: `Author name and ${brand.businessName} logo. Star rating or satisfaction indicator. Professional closing.`,
      textOverlay: `— ${content.testimonialAuthor}\n${brand.businessName}`,
      transition: 'fade',
      animation: 'name-card-slide',
    },
  ];

  return {
    prompt: `Create a ${durationSeconds}-second testimonial video for ${brand.businessName}. Quote: "${content.testimonialQuote}" — ${content.testimonialAuthor}. ${brandColorString(brand)} Professional, trustworthy aesthetic. Platform: ${req.platform}.`,
    scenes,
    voiceoverScript: `${content.testimonialQuote} — ${content.testimonialAuthor}`,
    musicMood: 'warm inspiring',
  };
}

function renderStatReveal(req: TemplateRenderRequest, def: VideoTemplateDefinition): TemplateRenderResult {
  const { brand, content, durationSeconds } = req;
  const stats = content.stats || [];
  const perStat = Math.floor((durationSeconds - 3) / Math.max(stats.length, 1));

  const scenes: TemplateScene[] = [];

  if (content.headline) {
    scenes.push({
      sceneNumber: 1,
      durationSeconds: 3,
      visualDescription: `Bold headline introducing the statistics. ${brand.businessName} branding.`,
      textOverlay: content.headline,
      transition: 'fade',
      animation: 'headline-impact',
    });
  }

  stats.forEach((stat, i) => {
    scenes.push({
      sceneNumber: scenes.length + 1,
      durationSeconds: i === stats.length - 1
        ? durationSeconds - scenes.reduce((s, sc) => s + sc.durationSeconds, 0)
        : perStat,
      visualDescription: `Animated number counting up to "${stat.value}" with label "${stat.label}". Dynamic data visualization.`,
      textOverlay: `${stat.value}\n${stat.label}`,
      transition: 'slide',
      animation: 'counter-roll-up',
    });
  });

  return {
    prompt: `Create a ${durationSeconds}-second animated statistics video for ${brand.businessName}. ${brandColorString(brand)} Stats: ${stats.map((s) => `${s.label}: ${s.value}`).join(', ')}. Dynamic counting animations and data visualization. Platform: ${req.platform}.`,
    scenes,
    voiceoverScript: stats.map((s) => `${s.label}: ${s.value}`).join('. '),
    musicMood: 'energetic confident',
  };
}

function renderTipCarousel(req: TemplateRenderRequest, def: VideoTemplateDefinition): TemplateRenderResult {
  const { brand, content, durationSeconds } = req;
  const tips = content.tips || [];
  const introTime = 3;
  const outroTime = 3;
  const tipTime = Math.floor((durationSeconds - introTime - outroTime) / Math.max(tips.length, 1));

  const scenes: TemplateScene[] = [
    {
      sceneNumber: 1,
      durationSeconds: introTime,
      visualDescription: `Opening card with headline and ${brand.businessName} logo. Numbered badge showing total tips count.`,
      textOverlay: content.headline ?? `${tips.length} Tips from ${brand.businessName}`,
      transition: 'fade',
      animation: 'card-flip-in',
    },
  ];

  tips.forEach((tip, i) => {
    scenes.push({
      sceneNumber: scenes.length + 1,
      durationSeconds: tipTime,
      visualDescription: `Tip #${i + 1} card slides in with numbered badge. Clean layout with key takeaway highlighted.`,
      textOverlay: `#${i + 1}: ${tip}`,
      transition: 'slide',
      animation: 'carousel-slide',
    });
  });

  scenes.push({
    sceneNumber: scenes.length + 1,
    durationSeconds: durationSeconds - scenes.reduce((s, sc) => s + sc.durationSeconds, 0),
    visualDescription: `Summary card with all tip numbers. ${brand.businessName} branding and CTA.`,
    textOverlay: content.callToAction ?? `Save this for later! Follow ${brand.businessName}`,
    transition: 'fade',
    animation: 'summary-grid',
  });

  return {
    prompt: `Create a ${durationSeconds}-second tip carousel video for ${brand.businessName}. ${brandColorString(brand)} ${tips.length} tips presented as dynamic numbered cards. Tips: ${tips.join('; ')}. Platform: ${req.platform}.`,
    scenes,
    voiceoverScript: tips.map((t, i) => `Tip ${i + 1}: ${t}`).join('. '),
    musicMood: 'upbeat educational',
  };
}

function renderTalkingHead(req: TemplateRenderRequest, def: VideoTemplateDefinition): TemplateRenderResult {
  const { brand, content, durationSeconds } = req;
  const scenes: TemplateScene[] = [
    {
      sceneNumber: 1,
      durationSeconds: 3,
      visualDescription: `Professional talking-head frame with ${brand.businessName} branded lower-third. Clean studio background.`,
      textOverlay: content.headline ?? brand.businessName,
      transition: 'fade',
      animation: 'lower-third-slide',
    },
    {
      sceneNumber: 2,
      durationSeconds: durationSeconds - 6,
      visualDescription: `Speaker delivering the main content. Key points appear as text callouts. Engaging eye contact with camera.`,
      textOverlay: content.bodyText,
      transition: 'cut',
    },
    {
      sceneNumber: 3,
      durationSeconds: 3,
      visualDescription: `Closing with ${brand.businessName} logo and subscribe/follow CTA.`,
      textOverlay: content.callToAction ?? `Follow ${brand.businessName} for more`,
      transition: 'fade',
      animation: 'logo-subscribe',
    },
  ];

  return {
    prompt: `Create a ${durationSeconds}-second professional talking-head video for ${brand.businessName}. ${brandColorString(brand)} Topic: ${content.bodyText}. Clean studio background, branded lower-thirds. Platform: ${req.platform}.`,
    scenes,
    voiceoverScript: content.bodyText || '',
    musicMood: 'professional subtle',
  };
}

function renderSlideshow(req: TemplateRenderRequest, def: VideoTemplateDefinition): TemplateRenderResult {
  const { brand, content, durationSeconds } = req;
  const bodyParts = (content.bodyText || '').split(/[.!?]+/).filter(Boolean);
  const slideCount = Math.min(bodyParts.length, 5) || 3;
  const slideDuration = Math.floor(durationSeconds / (slideCount + 1));

  const scenes: TemplateScene[] = [
    {
      sceneNumber: 1,
      durationSeconds: slideDuration,
      visualDescription: `Title slide with ${brand.businessName} branding. Elegant, clean design with subtle background animation.`,
      textOverlay: content.headline ?? brand.businessName,
      transition: 'fade',
      animation: 'ken-burns-zoom',
    },
  ];

  for (let i = 0; i < slideCount; i++) {
    scenes.push({
      sceneNumber: scenes.length + 1,
      durationSeconds: i === slideCount - 1
        ? durationSeconds - scenes.reduce((s, sc) => s + sc.durationSeconds, 0)
        : slideDuration,
      visualDescription: `Slide ${i + 1}: ${bodyParts[i]?.trim() || 'Visual content'}. Smooth Ken Burns effect on imagery.`,
      textOverlay: bodyParts[i]?.trim(),
      transition: 'dissolve',
      animation: 'ken-burns-pan',
    });
  }

  return {
    prompt: `Create a ${durationSeconds}-second polished slideshow video for ${brand.businessName}. ${brandColorString(brand)} Smooth transitions, Ken Burns effect on images. Content: ${content.bodyText}. Platform: ${req.platform}.`,
    scenes,
    voiceoverScript: content.bodyText || '',
    musicMood: 'smooth storytelling',
  };
}
