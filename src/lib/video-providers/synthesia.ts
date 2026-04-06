import type { VideoAspectRatio } from '@/lib/ai/types';
import type {
  IVideoProvider,
  VideoProviderGenerateRequest,
  VideoProviderJobResult,
  VideoProviderTemplate,
  VideoProviderWebhookPayload,
  ProviderJobStatus,
} from './types';
import { VideoProviderError } from './types';

// ============================================
// Synthesia API v2 Adapter
// ============================================

const SYNTHESIA_API_URL = 'https://api.synthesia.io/v2';
const SYNTHESIA_API_KEY = process.env.SYNTHESIA_API_KEY || '';

// Synthesia cost: ~$0.50 per minute of video
const COST_PER_MINUTE_CENTS = 50;

type SynthesiaVideoStatus = 'in_progress' | 'complete' | 'error';

interface SynthesiaCreateVideoRequest {
  title?: string;
  description?: string;
  visibility?: 'private' | 'public';
  aspectRatio?: '16:9' | '9:16' | '1:1';
  input: SynthesiaSceneInput[];
  callbackId?: string;
}

interface SynthesiaSceneInput {
  scriptText: string;
  avatar?: string;
  avatarSettings?: {
    voice?: string;
    horizontalAlign?: 'left' | 'center' | 'right';
    scale?: number;
    style?: 'rectangular' | 'circular';
  };
  background?: string;
}

interface SynthesiaVideoResponse {
  id: string;
  status: SynthesiaVideoStatus;
  title?: string;
  download?: string;
  thumbnail?: string;
  duration?: string; // ISO 8601 duration like "PT30S"
  visibility?: string;
  createdAt?: string;
  lastUpdatedAt?: string;
  error?: { message: string };
}

interface SynthesiaTemplateResponse {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  visibility: string;
}

function mapAspectRatio(ratio: VideoAspectRatio): '16:9' | '9:16' | '1:1' {
  switch (ratio) {
    case '16:9': return '16:9';
    case '9:16': return '9:16';
    case '1:1': return '1:1';
    default: return '16:9';
  }
}

function mapStatus(status: SynthesiaVideoStatus): ProviderJobStatus {
  switch (status) {
    case 'in_progress': return 'processing';
    case 'complete': return 'completed';
    case 'error': return 'failed';
    default: return 'pending';
  }
}

function parseDuration(iso8601: string | undefined): number | undefined {
  if (!iso8601) return undefined;
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

async function synthesiaFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${SYNTHESIA_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: SYNTHESIA_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'unknown error');
    throw new VideoProviderError(
      `Synthesia API ${res.status}: ${body}`,
      'synthesia',
      res.status,
      res.status === 429 || res.status >= 500
    );
  }

  return res.json() as Promise<T>;
}

function toJobResult(video: SynthesiaVideoResponse): VideoProviderJobResult {
  return {
    providerJobId: video.id,
    status: mapStatus(video.status),
    videoUrl: video.download,
    thumbnailUrl: video.thumbnail,
    durationSeconds: parseDuration(video.duration),
    errorMessage: video.error?.message,
    rawResponse: video as unknown as Record<string, unknown>,
  };
}

export class SynthesiaProvider implements IVideoProvider {
  readonly name = 'synthesia' as const;

  async generate(
    request: VideoProviderGenerateRequest
  ): Promise<VideoProviderJobResult> {
    const scriptText = request.scriptText || request.prompt;

    const scene: SynthesiaSceneInput = {
      scriptText,
      ...(request.avatarId ? { avatar: request.avatarId } : {}),
      ...(request.voiceId
        ? { avatarSettings: { voice: request.voiceId } }
        : {}),
      ...(request.backgroundUrl ? { background: request.backgroundUrl } : {}),
    };

    const body: SynthesiaCreateVideoRequest = {
      title: `TrueTwist Video - ${new Date().toISOString()}`,
      visibility: 'private',
      aspectRatio: mapAspectRatio(request.aspectRatio),
      input: [scene],
    };

    const video = await synthesiaFetch<SynthesiaVideoResponse>('/videos', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return toJobResult(video);
  }

  async getStatus(providerJobId: string): Promise<VideoProviderJobResult> {
    const video = await synthesiaFetch<SynthesiaVideoResponse>(
      `/videos/${providerJobId}`
    );
    return toJobResult(video);
  }

  async getResult(providerJobId: string): Promise<VideoProviderJobResult> {
    const video = await synthesiaFetch<SynthesiaVideoResponse>(
      `/videos/${providerJobId}`
    );

    if (video.status !== 'complete') {
      return toJobResult(video);
    }

    return toJobResult(video);
  }

  async listTemplates(): Promise<VideoProviderTemplate[]> {
    const response = await synthesiaFetch<{
      templates: SynthesiaTemplateResponse[];
    }>('/templates');

    return response.templates.map((t) => ({
      id: t.id,
      name: t.title,
      description: t.description,
      thumbnailUrl: t.thumbnail,
      aspectRatios: ['16:9', '9:16', '1:1'] as VideoAspectRatio[],
      maxDurationSeconds: 300, // Synthesia supports up to 5 min
    }));
  }

  isConfigured(): boolean {
    return !!SYNTHESIA_API_KEY;
  }

  /** Parse a Synthesia webhook payload into our unified format. */
  static parseWebhook(
    body: Record<string, unknown>
  ): VideoProviderWebhookPayload {
    const video = body as unknown as SynthesiaVideoResponse;
    return {
      provider: 'synthesia',
      providerJobId: video.id,
      status: mapStatus(video.status),
      videoUrl: video.download,
      thumbnailUrl: video.thumbnail,
      durationSeconds: parseDuration(video.duration),
      errorMessage: video.error?.message,
      rawPayload: body,
    };
  }
}

export function estimateCostCents(durationSeconds: number): number {
  return Math.ceil((durationSeconds / 60) * COST_PER_MINUTE_CENTS);
}
