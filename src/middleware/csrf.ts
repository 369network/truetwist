import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { Errors } from '@/lib/errors';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = '__Host-csrf-token';
const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Generate a cryptographically secure CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Validate CSRF token by comparing the header value against the cookie value.
 * Uses the double-submit cookie pattern: the token is stored in a __Host- cookie
 * (bound to HTTPS, no domain/path leakage) and must also be sent in the
 * X-CSRF-Token header. An attacker cannot read the cookie cross-origin, so
 * they cannot replicate the header.
 *
 * Skip validation for:
 * - Non-state-changing methods (GET, HEAD, OPTIONS)
 * - Requests with Bearer tokens (API-key / JWT authenticated — already cross-origin-safe)
 * - Webhook endpoints (signature-verified separately)
 */
export function validateCsrf(request: NextRequest): void {
  // Only enforce on state-changing methods
  if (!STATE_CHANGING_METHODS.includes(request.method)) {
    return;
  }

  // Skip CSRF for Bearer-authenticated API requests (JWT/API-key callers)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return;
  }

  // Skip CSRF for webhook endpoints (they use signature verification)
  if (request.nextUrl.pathname.startsWith('/api/webhooks/')) {
    return;
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    throw Errors.forbidden('Missing CSRF token');
  }

  // Constant-time comparison to prevent timing attacks
  const cookieBuf = Buffer.from(cookieToken, 'utf-8');
  const headerBuf = Buffer.from(headerToken, 'utf-8');

  if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
    throw Errors.forbidden('Invalid CSRF token');
  }
}

export { CSRF_COOKIE, CSRF_HEADER };
