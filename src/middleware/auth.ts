import { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import type { JwtPayload } from '@/types';

export function getAuthUser(request: NextRequest): JwtPayload {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw Errors.unauthorized('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  try {
    return verifyAccessToken(token);
  } catch {
    throw Errors.unauthorized('Invalid or expired token');
  }
}
