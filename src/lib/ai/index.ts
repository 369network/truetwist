export * from './types';
export { generateText, generateHashtags } from './text-generation-service';
export { generateImage } from './image-generation-service';
export {
  isConfigured as isGrokConfigured,
  estimateGrokImageCost,
} from './grok-client';
export { generateVideo, generateVideoScript } from './video-generation-service';
export {
  getUserCredits,
  checkCredits,
  recordGeneration,
  getGenerationHistory,
  getMonthlySpend,
} from './credit-service';
export { moderateContent } from './content-moderation';
export { optimizeAdBudget } from './ad-optimization-service';
export { generateAdCreative } from './ad-creative-service';

// Video Pipeline (Phase 3)
export {
  submitGeneration as submitRunwayGeneration,
  getTaskStatus as getRunwayTaskStatus,
  estimateCostCents as estimateRunwayCost,
  isConfigured as isRunwayConfigured,
} from './runway-client';
export {
  queueVideoGeneration,
  processVideoJob,
  getVideoJob,
  listVideoJobs,
  cancelVideoJob,
} from './video-queue-service';
export {
  PLATFORM_FORMATS,
  getPrimaryFormat,
  getPlatformFormats,
  getDimensions,
  clampDuration,
  buildPostProcessingSpec,
  generateSrt,
  getBatchVariantTargets,
} from './video-post-processing';
export {
  VIDEO_TEMPLATES,
  listTemplates,
  getTemplate,
  renderTemplate,
} from './video-templates';
