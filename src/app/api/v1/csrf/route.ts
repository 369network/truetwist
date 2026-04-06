export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { generateCsrfToken, CSRF_COOKIE } from '@/middleware/csrf';

/**
 * GET /api/v1/csrf — Issue a CSRF token.
 * Sets the token in a __Host- cookie and returns it in the response body
 * so the client can attach it as X-CSRF-Token on subsequent state-changing requests.
 */
export async function GET() {
  const token = generateCsrfToken();

  const response = NextResponse.json({ data: { csrfToken: token } });

  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  });

  return response;
}
