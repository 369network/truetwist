/**
 * Exponential backoff retry for ad platform API calls.
 * Handles 429 (rate limited) and 5xx (server error) responses.
 */

interface AdRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_OPTIONS: Required<AdRetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function computeDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelayMs;
  return Math.min(exponential + jitter, maxDelayMs);
}

/**
 * Wraps a fetch call with retry logic. Retries on 429 and 5xx
 * with exponential backoff + jitter. Respects Retry-After header.
 */
export async function adFetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: AdRetryOptions
): Promise<Response> {
  const { maxRetries, baseDelayMs, maxDelayMs } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(input, init);

    if (response.ok || !isRetryableStatus(response.status)) {
      return response;
    }

    lastResponse = response;

    if (attempt === maxRetries) break;

    // Respect Retry-After header if present
    const retryAfter = response.headers.get("Retry-After");
    let delay: number;

    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      delay = isNaN(seconds)
        ? computeDelay(attempt, baseDelayMs, maxDelayMs)
        : Math.min(seconds * 1000, maxDelayMs);
    } else {
      delay = computeDelay(attempt, baseDelayMs, maxDelayMs);
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return lastResponse!;
}
