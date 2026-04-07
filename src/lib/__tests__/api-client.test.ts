import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ApiClientError,
  postsApi,
  aiApi,
  socialAccountsApi,
  calendarApi,
} from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

Object.defineProperty(global, 'localStorage', {
  value: { getItem: vi.fn().mockReturnValue('test-token') },
  writable: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockOkResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

function mockErrorResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
  } as Response);
}

// ---------------------------------------------------------------------------
// ApiClientError
// ---------------------------------------------------------------------------

describe('ApiClientError', () => {
  it('sets status, code, message, and name correctly', () => {
    const err = new ApiClientError(404, 'NOT_FOUND', 'Resource not found');
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource not found');
    expect(err.name).toBe('ApiClientError');
  });

  it('is an instance of Error', () => {
    const err = new ApiClientError(500, 'SERVER_ERROR', 'Oops');
    expect(err instanceof Error).toBe(true);
  });

  it('stores optional details when provided', () => {
    const details = { field: 'email', reason: 'invalid' };
    const err = new ApiClientError(422, 'VALIDATION', 'Bad input', details);
    expect(err.details).toEqual(details);
  });

  it('details is undefined when not provided', () => {
    const err = new ApiClientError(401, 'UNAUTHORIZED', 'Not allowed');
    expect(err.details).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// request: headers
// ---------------------------------------------------------------------------

describe('request – headers', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(localStorage.getItem).mockReturnValue('test-token');
  });

  it('sends Content-Type: application/json on every request', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({ data: [] }));
    await socialAccountsApi.list();
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      'Content-Type': 'application/json',
    });
  });

  it('sends Authorization header when a token exists in localStorage', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({ data: [] }));
    await socialAccountsApi.list();
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer test-token',
    });
  });

  it('omits Authorization header when localStorage returns null', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(null);
    mockFetch.mockResolvedValueOnce(mockOkResponse({ data: [] }));
    await socialAccountsApi.list();
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit & { headers: Record<string, string> }).headers).not.toHaveProperty(
      'Authorization'
    );
  });
});

// ---------------------------------------------------------------------------
// postsApi.list
// ---------------------------------------------------------------------------

describe('postsApi.list', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(localStorage.getItem).mockReturnValue('test-token');
  });

  it('calls /api/v1/posts with no query string when params are empty', async () => {
    mockFetch.mockResolvedValueOnce(
      mockOkResponse({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 })
    );
    await postsApi.list();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/posts?');
  });

  it('builds correct query string with all params', async () => {
    mockFetch.mockResolvedValueOnce(
      mockOkResponse({ data: [], total: 0, page: 2, pageSize: 10, totalPages: 0 })
    );
    await postsApi.list({ businessId: 'biz-1', status: 'draft', page: 2, pageSize: 10 });
    const [url] = mockFetch.mock.calls[0];
    const params = new URL(url, 'http://localhost').searchParams;
    expect(params.get('businessId')).toBe('biz-1');
    expect(params.get('status')).toBe('draft');
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('10');
  });

  it('omits undefined params from query string', async () => {
    mockFetch.mockResolvedValueOnce(
      mockOkResponse({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 })
    );
    await postsApi.list({ status: 'published' });
    const [url] = mockFetch.mock.calls[0];
    const params = new URL(url, 'http://localhost').searchParams;
    expect(params.has('businessId')).toBe(false);
    expect(params.get('status')).toBe('published');
  });
});

// ---------------------------------------------------------------------------
// postsApi.get
// ---------------------------------------------------------------------------

describe('postsApi.get', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('calls the correct URL for a given post ID', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({ data: { id: 'post-abc' } }));
    await postsApi.get('post-abc');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/posts/post-abc');
  });
});

// ---------------------------------------------------------------------------
// postsApi.create
// ---------------------------------------------------------------------------

describe('postsApi.create', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends a POST request to /api/v1/posts', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({ data: { id: 'new-post' } }));
    await postsApi.create({ businessId: 'biz-1', contentText: 'Hello world' });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/posts');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('serialises the body as JSON', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({ data: { id: 'new-post' } }));
    const payload = { businessId: 'biz-1', contentText: 'Hello world', contentType: 'text' };
    await postsApi.create(payload);
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(payload);
  });
});

// ---------------------------------------------------------------------------
// postsApi.delete
// ---------------------------------------------------------------------------

describe('postsApi.delete', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends a DELETE request to the correct URL', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({ data: { message: 'Deleted' } }));
    await postsApi.delete('post-xyz');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/posts/post-xyz');
    expect((init as RequestInit).method).toBe('DELETE');
  });
});

// ---------------------------------------------------------------------------
// aiApi.generateText
// ---------------------------------------------------------------------------

describe('aiApi.generateText', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends a POST to /api/v1/ai/generate', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({ data: { type: 'text', variations: [], suggestedHashtags: [] } }));
    await aiApi.generateText({ prompt: 'Write a tweet', platforms: ['twitter'] });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/ai/generate');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('includes type: "text" and all provided fields in the body', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({ data: { type: 'text', variations: [], suggestedHashtags: [] } }));
    await aiApi.generateText({
      prompt: 'Write a tweet',
      platforms: ['twitter', 'linkedin'],
      variations: 3,
      businessId: 'biz-1',
    });
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.type).toBe('text');
    expect(body.prompt).toBe('Write a tweet');
    expect(body.platforms).toEqual(['twitter', 'linkedin']);
    expect(body.variations).toBe(3);
    expect(body.businessId).toBe('biz-1');
  });
});

// ---------------------------------------------------------------------------
// socialAccountsApi.list
// ---------------------------------------------------------------------------

describe('socialAccountsApi.list', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends a GET request to /api/v1/social-accounts', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({ data: [] }));
    await socialAccountsApi.list();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/social-accounts');
    // GET is the default – method should be absent or undefined
    expect((init as RequestInit).method).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// calendarApi.getEvents
// ---------------------------------------------------------------------------

describe('calendarApi.getEvents', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('builds the correct URL with start and end params', async () => {
    mockFetch.mockResolvedValueOnce(
      mockOkResponse({ data: { view: 'month', from: '2026-04-01', to: '2026-04-30', totalSchedules: 0, days: [] } })
    );
    await calendarApi.getEvents('2026-04-01', '2026-04-30');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/calendar?start=2026-04-01&end=2026-04-30');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('throws ApiClientError with correct status and code on a 400 response', async () => {
    mockFetch.mockResolvedValueOnce(
      mockErrorResponse(400, { error: { code: 'BAD_REQUEST', message: 'Missing field' } })
    );
    await expect(postsApi.list()).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Missing field',
    });
  });

  it('throws ApiClientError with correct status on a 401 response', async () => {
    mockFetch.mockResolvedValueOnce(
      mockErrorResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } })
    );
    await expect(postsApi.get('any')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('includes details from the error body when present', async () => {
    const details = [{ field: 'email', issue: 'required' }];
    mockFetch.mockResolvedValueOnce(
      mockErrorResponse(422, { error: { code: 'VALIDATION', message: 'Invalid', details } })
    );
    await expect(postsApi.create({ businessId: 'b' })).rejects.toMatchObject({
      details,
    });
  });

  it('falls back to UNKNOWN code when error body has no code', async () => {
    mockFetch.mockResolvedValueOnce(
      mockErrorResponse(500, { error: { message: 'Internal error' } })
    );
    await expect(socialAccountsApi.list()).rejects.toMatchObject({
      code: 'UNKNOWN',
      status: 500,
    });
  });

  it('handles unparseable error body gracefully (json() rejects)', async () => {
    mockFetch.mockResolvedValueOnce(
      Promise.resolve({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      } as Response)
    );
    await expect(socialAccountsApi.list()).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 503,
      code: 'UNKNOWN',
      message: 'Service Unavailable',
    });
  });
});
