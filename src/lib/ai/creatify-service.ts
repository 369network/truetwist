import type { VideoAspectRatio, BrandContext } from './types';

const CREATIFY_API_URL = 'https://api.creatify.ai/api';

interface CreatifyConfig {
  apiKey: string;
  workspaceId: string;
}

interface CreatifyVideoRequest {
  url: string;
  platform: string;
  aspectRatio: VideoAspectRatio;
  style?: string;
  voiceover?: boolean;
  brand?: BrandContext;
  durationSeconds?: number;
}

interface CreatifyVideoJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  error?: string;
  createdAt: string;
}

interface CreatifyTemplate {
  id: string;
  name: string;
  description: string;
  previewUrl: string;
  category: string;
}

function getConfig(): CreatifyConfig {
  const apiKey = process.env.CREATIFY_API_KEY;
  const workspaceId = process.env.CREATIFY_WORKSPACE_ID;

  if (!apiKey || apiKey === 'pending_setup') {
    throw new Error(
      'CREATIFY_API_KEY not configured. Set it in Vercel environment variables.'
    );
  }
  if (!workspaceId || workspaceId === 'pending_setup') {
    throw new Error(
      'CREATIFY_WORKSPACE_ID not configured. Set it in Vercel environment variables.'
    );
  }

  return { apiKey, workspaceId };
}

async function creatifyRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const config = getConfig();

  const res = await fetch(`${CREATIFY_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': config.apiKey,
      'X-WORKSPACE-ID': config.workspaceId,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'Unknown error');
    throw new Error(
      `Creatify API error (${res.status}): ${res.statusText}`
    );
  }

  return res.json();
}

export class CreatifyService {
  /**
   * Submit a URL-to-video ad generation job to Creatify.
   * Returns a job ID that can be polled for completion.
   */
  static async createVideoFromUrl(
    request: CreatifyVideoRequest
  ): Promise<{ jobId: string }> {
    const aspectMap: Record<VideoAspectRatio, string> = {
      '9:16': 'portrait',
      '16:9': 'landscape',
      '1:1': 'square',
    };

    const body: Record<string, unknown> = {
      url: request.url,
      aspect_ratio: aspectMap[request.aspectRatio] || 'landscape',
      platform: request.platform,
      style: request.style || 'professional',
      voiceover: request.voiceover ?? true,
    };

    if (request.durationSeconds) {
      body.duration = request.durationSeconds;
    }

    if (request.brand) {
      body.brand_name = request.brand.businessName;
      if (request.brand.colors) {
        body.brand_color = request.brand.colors.primary;
      }
      if (request.brand.logoUrl) {
        body.logo_url = request.brand.logoUrl;
      }
    }

    const result = await creatifyRequest<{ id: string }>('/url-to-video/', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return { jobId: result.id };
  }

  /**
   * Poll a video generation job for status updates.
   */
  static async getJobStatus(jobId: string): Promise<CreatifyVideoJob> {
    const result = await creatifyRequest<{
      id: string;
      status: string;
      output?: { video_url: string; thumbnail_url: string; duration: number };
      error?: string;
      created_at: string;
    }>(`/url-to-video/${jobId}/`);

    return {
      id: result.id,
      status: mapStatus(result.status),
      videoUrl: result.output?.video_url,
      thumbnailUrl: result.output?.thumbnail_url,
      durationSeconds: result.output?.duration,
      error: result.error,
      createdAt: result.created_at,
    };
  }

  /**
   * List available video ad templates from Creatify.
   */
  static async listTemplates(): Promise<CreatifyTemplate[]> {
    const result = await creatifyRequest<
      Array<{
        id: string;
        name: string;
        description: string;
        preview_url: string;
        category: string;
      }>
    >('/templates/');

    return result.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      previewUrl: t.preview_url,
      category: t.category,
    }));
  }

  /**
   * Create a video ad from a specific template.
   */
  static async createVideoFromTemplate(
    templateId: string,
    params: {
      productUrl: string;
      headline?: string;
      description?: string;
      callToAction?: string;
      aspectRatio: VideoAspectRatio;
      brand?: BrandContext;
    }
  ): Promise<{ jobId: string }> {
    const aspectMap: Record<VideoAspectRatio, string> = {
      '9:16': 'portrait',
      '16:9': 'landscape',
      '1:1': 'square',
    };

    const body: Record<string, unknown> = {
      template_id: templateId,
      url: params.productUrl,
      aspect_ratio: aspectMap[params.aspectRatio] || 'landscape',
      headline: params.headline,
      description: params.description,
      cta: params.callToAction || 'Learn More',
    };

    if (params.brand) {
      body.brand_name = params.brand.businessName;
      if (params.brand.colors) {
        body.brand_color = params.brand.colors.primary;
      }
      if (params.brand.logoUrl) {
        body.logo_url = params.brand.logoUrl;
      }
    }

    const result = await creatifyRequest<{ id: string }>(
      '/url-to-video/',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return { jobId: result.id };
  }
}

function mapStatus(
  apiStatus: string
): 'pending' | 'processing' | 'completed' | 'failed' {
  switch (apiStatus) {
    case 'done':
    case 'completed':
      return 'completed';
    case 'failed':
    case 'error':
      return 'failed';
    case 'processing':
    case 'rendering':
      return 'processing';
    default:
      return 'pending';
  }
}

export type { CreatifyVideoRequest, CreatifyVideoJob, CreatifyTemplate };
