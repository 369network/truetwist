import type { VideoAspectRatio } from './types';

// ============================================
// Runway Gen-3 Alpha API Client
// ============================================

const RUNWAY_API_URL = process.env.RUNWAY_API_URL || 'https://api.dev.runwayml.com/v1';
const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY || '';

// Cost per 5 seconds of Runway Gen-3 video (in cents)
const COST_PER_5_SEC_CENTS = 50;

export type RunwayTaskStatus =
  | 'PENDING'
  | 'THROTTLED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED';

export interface RunwayGenerateRequest {
  promptText: string;
  duration: 5 | 10;
  ratio: '1280:720' | '720:1280' | '1024:1024';
  watermark?: boolean;
  seed?: number;
}

export interface RunwayTaskResponse {
  id: string;
  status: RunwayTaskStatus;
  progress?: number;
  output?: string[]; // video URLs when SUCCEEDED
  failure?: string;
  createdAt: string;
}

function aspectRatioToRunway(ratio: VideoAspectRatio): RunwayGenerateRequest['ratio'] {
  switch (ratio) {
    case '16:9': return '1280:720';
    case '9:16': return '720:1280';
    case '1:1': return '1024:1024';
    default: return '1280:720';
  }
}

function runwayDuration(seconds: number): 5 | 10 {
  return seconds <= 5 ? 5 : 10;
}

async function runwayFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${RUNWAY_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${RUNWAY_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'unknown error');
    throw new RunwayApiError(
      `Runway API ${res.status}: ${body}`,
      res.status,
      body
    );
  }

  return res.json() as Promise<T>;
}

export class RunwayApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string
  ) {
    super(message);
    this.name = 'RunwayApiError';
  }

  get isRetryable(): boolean {
    return this.statusCode === 429 || this.statusCode >= 500;
  }
}

/**
 * Submit a text-to-video generation task to Runway Gen-3.
 */
export async function submitGeneration(params: {
  prompt: string;
  aspectRatio: VideoAspectRatio;
  durationSeconds: number;
  seed?: number;
}): Promise<{ taskId: string }> {
  const body: RunwayGenerateRequest = {
    promptText: params.prompt,
    duration: runwayDuration(params.durationSeconds),
    ratio: aspectRatioToRunway(params.aspectRatio),
    watermark: false,
    seed: params.seed,
  };

  const response = await runwayFetch<{ id: string }>('/image_to_video', {
    method: 'POST',
    body: JSON.stringify({
      model: 'gen3a_turbo',
      promptText: body.promptText,
      duration: body.duration,
      ratio: body.ratio,
      watermark: body.watermark,
      ...(body.seed !== undefined ? { seed: body.seed } : {}),
    }),
  });

  return { taskId: response.id };
}

/**
 * Poll a Runway task for completion status.
 */
export async function getTaskStatus(taskId: string): Promise<RunwayTaskResponse> {
  return runwayFetch<RunwayTaskResponse>(`/tasks/${taskId}`);
}

/**
 * Poll until the task completes or fails. Returns the final task state.
 */
export async function waitForCompletion(
  taskId: string,
  options?: { maxWaitMs?: number; pollIntervalMs?: number }
): Promise<RunwayTaskResponse> {
  const maxWait = options?.maxWaitMs ?? 300_000; // 5 minutes
  const interval = options?.pollIntervalMs ?? 5_000; // 5 seconds
  const deadline = Date.now() + maxWait;

  while (Date.now() < deadline) {
    const task = await getTaskStatus(taskId);

    if (task.status === 'SUCCEEDED' || task.status === 'FAILED') {
      return task;
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new RunwayApiError(
    `Runway task ${taskId} timed out after ${maxWait}ms`,
    408,
    'TIMEOUT'
  );
}

/**
 * Cancel a running Runway task.
 */
export async function cancelTask(taskId: string): Promise<void> {
  await runwayFetch(`/tasks/${taskId}/cancel`, { method: 'POST' });
}

/**
 * Estimate cost in cents for a given duration.
 */
export function estimateCostCents(durationSeconds: number): number {
  return Math.ceil((durationSeconds / 5) * COST_PER_5_SEC_CENTS);
}

/**
 * Check if the Runway API is accessible.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await runwayFetch('/health');
    return true;
  } catch {
    return false;
  }
}

export function isConfigured(): boolean {
  return !!RUNWAY_API_KEY;
}
