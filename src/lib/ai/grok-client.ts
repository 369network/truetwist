import OpenAI from 'openai';

// ============================================
// xAI Grok API Client (OpenAI-compatible)
// ============================================

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = 'https://api.x.ai/v1';

const globalForGrok = globalThis as unknown as {
  grokClient: OpenAI | undefined;
};

function createGrokClient(): OpenAI {
  if (!XAI_API_KEY) {
    throw new GrokApiError(
      'XAI_API_KEY environment variable is not configured',
      401,
      'MISSING_API_KEY'
    );
  }

  return new OpenAI({
    apiKey: XAI_API_KEY,
    baseURL: XAI_BASE_URL,
  });
}

export function getGrokClient(): OpenAI {
  if (!globalForGrok.grokClient) {
    globalForGrok.grokClient = createGrokClient();
  }
  return globalForGrok.grokClient;
}

if (process.env.NODE_ENV !== 'production') {
  // Allow hot-reload in dev without recreating client
  try {
    if (XAI_API_KEY && !globalForGrok.grokClient) {
      globalForGrok.grokClient = createGrokClient();
    }
  } catch {
    // Silently skip if key not configured
  }
}

export class GrokApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string
  ) {
    super(message);
    this.name = 'GrokApiError';
  }

  get isRetryable(): boolean {
    return this.statusCode === 429 || this.statusCode >= 500;
  }
}

// Aurora image generation: $0.01 per image (estimated)
const GROK_IMAGE_COST_CENTS = 1;

export function estimateGrokImageCost(count: number): number {
  return GROK_IMAGE_COST_CENTS * count;
}

export function isConfigured(): boolean {
  return !!XAI_API_KEY;
}
