import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths exempt from rate limiting (health checks, webhooks)
const RATE_LIMIT_EXEMPT = ['/api/v1/health', '/api/webhooks/'];

// Plan-based rate limits (requests per minute) for JWT-authenticated routes
const PLAN_RATE_LIMITS: Record<string, number> = {
  free: 30,
  starter: 120,
  pro: 300,
  enterprise: 1000,
};

// In-memory sliding window counters (Edge Runtime compatible, per-instance)
const windowCounters = new Map<string, { count: number; resetAt: number }>();

function checkInMemoryRateLimit(identifier: string, max: number): { allowed: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const resetAt = now + windowMs;

  const entry = windowCounters.get(identifier);
  if (!entry || entry.resetAt <= now) {
    windowCounters.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, reset: Math.ceil(resetAt / 1000) };
  }

  entry.count++;
  if (entry.count > max) {
    return { allowed: false, remaining: 0, reset: Math.ceil(entry.resetAt / 1000) };
  }
  return { allowed: true, remaining: max - entry.count, reset: Math.ceil(entry.resetAt / 1000) };
}

// Periodically clean up expired entries
let lastCleanup = Date.now();
function cleanupCounters() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  windowCounters.forEach((entry, key) => {
    if (entry.resetAt <= now) windowCounters.delete(key);
  });
}

// Security headers applied to all responses
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

// CSP directives — strict but compatible with Next.js
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.openai.com wss://*.supabase.co https://*.sentry.io",
  "frame-src 'self' https://js.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
];

// Static asset cache patterns
const IMMUTABLE_PATTERN = /\/_next\/static\//;
const STATIC_ASSET_PATTERN = /\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // Correlation ID — propagate or generate
  const correlationId =
    request.headers.get('x-correlation-id') ||
    request.headers.get('x-request-id') ||
    crypto.randomUUID();
  response.headers.set('x-correlation-id', correlationId);

  // Cache control for static assets
  if (IMMUTABLE_PATTERN.test(pathname)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (STATIC_ASSET_PATTERN.test(pathname)) {
    response.headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=43200');
  }

  // Apply security headers to ALL responses
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  response.headers.set('Content-Security-Policy', CSP_DIRECTIVES.join('; '));

  // CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin') || '';
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ];

    if (allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Api-Key, X-Correlation-Id');
    response.headers.set('Access-Control-Expose-Headers', 'X-Correlation-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset');
    response.headers.set('Access-Control-Max-Age', '86400');

    // API responses should not be cached by default
    if (!response.headers.has('Cache-Control')) {
      response.headers.set('Cache-Control', 'no-store');
    }

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers });
    }

    // Rate limiting for non-exempt API routes
    const pathname = request.nextUrl.pathname;
    const isExempt = RATE_LIMIT_EXEMPT.some((p) => pathname.startsWith(p));

    if (!isExempt) {
      // API key requests are rate-limited in the api-key middleware (Redis-backed),
      // so only apply edge rate limiting for non-API-key requests here.
      const authHeader = request.headers.get('authorization') || '';
      const hasApiKey = request.headers.get('x-api-key') || authHeader.startsWith('Bearer tt_');

      if (!hasApiKey) {
        let identifier: string;
        let max: number;

        try {
          // Decode JWT payload without full verification (verification happens in route handlers)
          const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
          if (token) {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
              identifier = `jwt:${payload.sub}`;
              max = PLAN_RATE_LIMITS[payload.plan] || PLAN_RATE_LIMITS.free;
            } else {
              throw new Error('invalid token');
            }
          } else {
            identifier = `ip:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'}`;
            max = PLAN_RATE_LIMITS.free;
          }
        } catch {
          identifier = `ip:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'}`;
          max = PLAN_RATE_LIMITS.free;
        }

        cleanupCounters();
        const result = checkInMemoryRateLimit(identifier, max);

        response.headers.set('X-RateLimit-Limit', String(max));
        response.headers.set('X-RateLimit-Remaining', String(result.remaining));
        response.headers.set('X-RateLimit-Reset', String(result.reset));

        if (!result.allowed) {
          return NextResponse.json(
            { error: { error: 'Too many requests', code: 'RATE_LIMITED' } },
            {
              status: 429,
              headers: {
                'Retry-After': String(Math.ceil((result.reset * 1000 - Date.now()) / 1000)),
                'X-RateLimit-Limit': String(max),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(result.reset),
              },
            }
          );
        }
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and _next internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
