import { createHmac, randomUUID } from 'crypto';

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

interface OAuthStatePayload {
  userId: string;
}

interface OAuthStateData extends OAuthStatePayload {
  nonce: string;
  iat: number;
}

function getSigningKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required for OAuth state signing');
  }
  return key;
}

function hmacSign(data: string): string {
  return createHmac('sha256', getSigningKey()).update(data).digest('base64url');
}

/**
 * Creates a signed, time-limited OAuth state parameter.
 * The state is base64url(JSON) + "." + HMAC-SHA256 signature.
 */
export function signOAuthState(payload: OAuthStatePayload): string {
  const data: OAuthStateData = {
    ...payload,
    nonce: randomUUID(),
    iat: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = hmacSign(encoded);
  return `${encoded}.${signature}`;
}

/**
 * Verifies and decodes an OAuth state parameter.
 * Returns the payload if valid and not expired, or null otherwise.
 */
export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const dotIndex = state.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const encoded = state.slice(0, dotIndex);
  const signature = state.slice(dotIndex + 1);

  const expectedSignature = hmacSign(encoded);
  if (signature !== expectedSignature) return null;

  try {
    const data: OAuthStateData = JSON.parse(
      Buffer.from(encoded, 'base64url').toString()
    );

    if (Date.now() - data.iat > STATE_MAX_AGE_MS) return null;
    if (!data.userId || !data.nonce) return null;

    return { userId: data.userId };
  } catch {
    return null;
  }
}
