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
// HeyGen API Adapter
// ============================================

const HEYGEN_API_URL = 'https://api.heygen.com/v2';
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || '';

// HeyGen cost: ~$0.48 per minute
const COST_PER_MINUTE_CENTS = 48;

type HeyGenVideoStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

interface HeyGenCreateVideoRequest {
  video_inputs: HeyGenVideoInput[];
  dimension?: { width: number; height: number };
  aspect_ratio?: '16:9' | '9:16' | '1:1';
  callback_id?: string;
}

interface HeyGenVideoInput {
  character: {
    type: 'avatar';
    avatar_id: string;
    avatar_style?: 'normal' | 'circle' | 'closeUp';
  };
  voice: {
    type: 'text';
    input_text: string;
    voice_id?: string;
    speed?: number;
  };
  background?: {
    type: 'color' | 'image';
    value: string;
  };
}

interface HeyGenVideoStatusResponse {
  data: {
    video_id: string;
    status: HeyGenVideoStatus;
    video_url?: string;
    thumbnail_url?: string;
    duration?: number;
    error?: { message: string };
  };
}

interface HeyGenCreateVideoResponse {
  data: {
    video_id: string;
  };
}

interface HeyGenAvatarResponse {
  data: {
    avatars: Array<{
      avatar_id: string;
      avatar_name: string;
      preview_image_url?: string;
    }>;
  };
}

function mapAspectRatio(ratio: VideoAspectRatio): '16:9' | '9:16' | '1:1' {
  switch (ratio) {
    case '16:9': return '16:9';
    case '9:16': return '9:16';
    case '1:1': return '1:1';
    default: return '16:9';
  }
}

function mapStatus(status: HeyGenVideoStatus): ProviderJobStatus {
  switch (status) {
    case 'pending': return 'pending';
    case 'processing': return 'processing';
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    default: return 'pending';
  }
}

const DEFAULT_AVATAR_ID = 'Daisy-inskirt-20220818';

async function heygenFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${HEYGEN_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Api-Key': HEYGEN_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'unknown error');
    throw new VideoProviderError(
      `HeyGen API ${res.status}: ${body}`,
      'heygen',
      res.status,
      res.status === 429 || res.status >= 500
    );
  }

  return res.json() as Promise<T>;
}

export class HeyGenProvider implements IVideoProvider {
  readonly name = 'heygen' as const;

  async generate(
    request: VideoProviderGenerateRequest
  ): Promise<VideoProviderJobResult> {
    const scriptText = request.scriptText || request.prompt;
    const avatarId = request.avatarId || DEFAULT_AVATAR_ID;

    const videoInput: HeyGenVideoInput = {
      character: {
        type: 'avatar',
        avatar_id: avatarId,
        avatar_style: 'normal',
      },
      voice: {
        type: 'text',
        input_text: scriptText,
        ...(request.voiceId ? { voice_id: request.voiceId } : {}),
      },
      ...(request.backgroundUrl
        ? {
            background: {
              type: 'image' as const,
              value: request.backgroundUrl,
            },
          }
        : {}),
    };

    const body: HeyGenCreateVideoRequest = {
      video_inputs: [videoInput],
      aspect_ratio: mapAspectRatio(request.aspectRatio),
    };

    const response = await heygenFetch<HeyGenCreateVideoResponse>(
      '/video/generate',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return {
      providerJobId: response.data.video_id,
      status: 'pending',
    };
  }

  async getStatus(providerJobId: string): Promise<VideoProviderJobResult> {
    const response = await heygenFetch<HeyGenVideoStatusResponse>(
      `/video_status.get?video_id=${providerJobId}`
    );

    const data = response.data;
    return {
      providerJobId: data.video_id,
      status: mapStatus(data.status),
      videoUrl: data.video_url,
      thumbnailUrl: data.thumbnail_url,
      durationSeconds: data.duration,
      errorMessage: data.error?.message,
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }

  async getResult(providerJobId: string): Promise<VideoProviderJobResult> {
    return this.getStatus(providerJobId);
  }

  async listTemplates(): Promise<VideoProviderTemplate[]> {
    const response = await heygenFetch<HeyGenAvatarResponse>('/avatars');

    return response.data.avatars.map((a) => ({
      id: a.avatar_id,
      name: a.avatar_name,
      thumbnailUrl: a.preview_image_url,
      aspectRatios: ['16:9', '9:16', '1:1'] as VideoAspectRatio[],
      maxDurationSeconds: 300,
    }));
  }

  isConfigured(): boolean {
    return !!HEYGEN_API_KEY;
  }

  /** Parse a HeyGen webhook payload into our unified format. */
  static parseWebhook(
    body: Record<string, unknown>
  ): VideoProviderWebhookPayload {
    const event = body as {
      event_type?: string;
      event_data?: {
        video_id: string;
        status: HeyGenVideoStatus;
        url?: string;
        thumbnail_url?: string;
        duration?: number;
        error?: { message: string };
      };
    };

    const data = event.event_data;
    if (!data) {
      throw new VideoProviderError(
        'Invalid HeyGen webhook: missing event_data',
        'heygen'
      );
    }

    return {
      provider: 'heygen',
      providerJobId: data.video_id,
      status: mapStatus(data.status),
      videoUrl: data.url,
      thumbnailUrl: data.thumbnail_url,
      durationSeconds: data.duration,
      errorMessage: data.error?.message,
      rawPayload: body,
    };
  }
}

export function estimateCostCents(durationSeconds: number): number {
  return Math.ceil((durationSeconds / 60) * COST_PER_MINUTE_CENTS);
}
