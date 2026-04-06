/**
 * Centralized security configuration for TrueTwist.
 * All security-sensitive defaults live here so they can be audited in one place.
 */

export const SecurityConfig = {
  /** Session / Token policy */
  session: {
    accessTokenExpiryMinutes: 15,
    refreshTokenExpiryDays: 7,
    maxConcurrentSessions: 5, // per user
    idleTimeoutMinutes: 30,
  },

  /** Cookie defaults for all auth-related cookies */
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  },

  /** Password policy */
  password: {
    minLength: 8,
    requireUppercase: true,
    requireNumber: true,
    bcryptRounds: 12,
  },

  /** Rate limiting defaults */
  rateLimit: {
    loginMaxAttempts: 5,
    loginWindowMs: 15 * 60 * 1000, // 15 minutes
    apiDefaultWindowMs: 60_000, // 1 minute
  },

  /** CORS policy */
  cors: {
    maxAge: 86400,
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  },

  /** JWT configuration */
  jwt: {
    algorithm: 'HS256' as const,
    issuer: 'truetwist',
  },
} as const;
