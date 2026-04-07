import type { VideoAspectRatio } from '@/lib/ai/types';

// ============================================
// Video Provider Abstraction Layer
// ============================================

export type VideoProviderName = 'synthesia' | 'heygen' | 'runway';

export type ProviderJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface VideoProviderGenerateRequest {
  prompt: string;
  scriptText?: string;
  aspectRatio: VideoAspectRatio;
  durationSeconds: number;
  templateId?: string;
  avatarId?: string;
  voiceId?: string;
  backgroundUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface VideoProviderJobResult {
  providerJobId: string;
  status: ProviderJobStatus;
  videoUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  errorMessage?: string;
  rawResponse?: Record<string, unknown>;
}

export interface VideoProviderTemplate {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  aspectRatios: VideoAspectRatio[];
  maxDurationSeconds: number;
}

export interface IVideoProvider {
  readonly name: VideoProviderName;

  /** Submit a video generation job. Returns the provider's job ID. */
  generate(request: VideoProviderGenerateRequest): Promise<VideoProviderJobResult>;

  /** Poll for the current status and result of a job. */
  getStatus(providerJobId: string): Promise<VideoProviderJobResult>;

  /** Fetch the final result (video URL, thumbnail, etc.) of a completed job. */
  getResult(providerJobId: string): Promise<VideoProviderJobResult>;

  /** List available templates from this provider. */
  listTemplates?(): Promise<VideoProviderTemplate[]>;

  /** Check if the provider is configured (API key set). */
  isConfigured(): boolean;
}

export interface VideoProviderWebhookPayload {
  provider: VideoProviderName;
  providerJobId: string;
  status: ProviderJobStatus;
  videoUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  errorMessage?: string;
  rawPayload: Record<string, unknown>;
}

export class VideoProviderError extends Error {
  constructor(
    message: string,
    public provider: VideoProviderName,
    public statusCode?: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'VideoProviderError';
  }
}
