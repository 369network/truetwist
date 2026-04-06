export * from './types';
export { generateText, generateHashtags } from './text-generation-service';
export { generateImage } from './image-generation-service';
export { generateVideo, generateVideoScript } from './video-generation-service';
export {
  getUserCredits,
  checkCredits,
  recordGeneration,
  getGenerationHistory,
  getMonthlySpend,
} from './credit-service';
export { moderateContent } from './content-moderation';
export { getTextModelConfig, estimateTokenCost } from './model-config';
export type { ModelConfig } from './model-config';
export { scoreContent } from './content-quality-scoring';
export type { QualityDimensions, ContentQualityResult } from './content-quality-scoring';
export {
  recordFeedback,
  getUserFeedbackStats,
  getUserPreferences,
  getGenerationScore,
} from './feedback-service';
export type { FeedbackAction, ContentFeedbackInput, FeedbackStats } from './feedback-service';

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
