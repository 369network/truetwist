import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import type { ApiError } from '@/types';
import { createLogger } from '@/lib/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorResponse(error: unknown): NextResponse<{ error: ApiError }> {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { error: error.message, code: error.code, details: error.details } },
      { status: error.statusCode }
    );
  }

  const logger = createLogger('api.error');
  logger.error('Unhandled error', { error: error instanceof Error ? error.message : String(error) });
  Sentry.captureException(error);
  return NextResponse.json(
    { error: { error: 'Internal server error', code: 'INTERNAL_ERROR' } },
    { status: 500 }
  );
}

export const Errors = {
  unauthorized: (msg = 'Unauthorized') => new AppError(401, 'UNAUTHORIZED', msg),
  forbidden: (msg = 'Forbidden') => new AppError(403, 'FORBIDDEN', msg),
  notFound: (resource = 'Resource') => new AppError(404, 'NOT_FOUND', `${resource} not found`),
  conflict: (msg: string) => new AppError(409, 'CONFLICT', msg),
  validation: (details: unknown) => new AppError(422, 'VALIDATION_ERROR', 'Validation failed', details),
  rateLimited: () => new AppError(429, 'RATE_LIMITED', 'Too many requests'),
  badRequest: (msg: string) => new AppError(400, 'BAD_REQUEST', msg),
};
