import { describe, it, expect, beforeAll } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
} from '@/lib/auth';

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-unit-tests';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-for-unit-tests';
});

describe('auth module', () => {
  describe('hashPassword / verifyPassword', () => {
    it('should hash a password and verify it correctly', async () => {
      const password = 'TestPass123';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(await verifyPassword(password, hash)).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const hash = await hashPassword('TestPass123');
      expect(await verifyPassword('WrongPass456', hash)).toBe(false);
    });

    it('should produce different hashes for the same password (salt)', async () => {
      const hash1 = await hashPassword('TestPass123');
      const hash2 = await hashPassword('TestPass123');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateAccessToken / verifyAccessToken', () => {
    it('should generate and verify a valid access token', () => {
      const token = generateAccessToken('user-123', 'test@example.com', 'free');
      const payload = verifyAccessToken(token);
      expect(payload.sub).toBe('user-123');
      expect(payload.email).toBe('test@example.com');
      expect(payload.plan).toBe('free');
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();
    });

    it('should reject a tampered token', () => {
      const token = generateAccessToken('user-123', 'test@example.com', 'free');
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyAccessToken(tampered)).toThrow();
    });

    it('should reject a completely invalid token', () => {
      expect(() => verifyAccessToken('not-a-jwt')).toThrow();
    });

    it('should reject an empty string', () => {
      expect(() => verifyAccessToken('')).toThrow();
    });
  });

  describe('generateRefreshToken / verifyRefreshToken', () => {
    it('should generate a refresh token with jti', () => {
      const { token, jti } = generateRefreshToken('user-123');
      expect(token).toBeTruthy();
      expect(jti).toBeTruthy();
      // jti should be a UUID v4
      expect(jti).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it('should verify a valid refresh token', () => {
      const { token } = generateRefreshToken('user-123');
      const payload = verifyRefreshToken(token);
      expect(payload.sub).toBe('user-123');
      expect(payload.jti).toBeDefined();
    });

    it('should reject an access token as refresh token', () => {
      const accessToken = generateAccessToken('user-123', 'test@example.com', 'free');
      // Access token is signed with different secret, so verification should fail
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });
  });

  describe('hashToken', () => {
    it('should produce a consistent SHA-256 hash', () => {
      const token = 'some-token-value';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string
    });

    it('should produce different hashes for different tokens', () => {
      expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
    });
  });

  describe('getRefreshTokenExpiry', () => {
    it('should return a date 7 days in the future', () => {
      const expiry = getRefreshTokenExpiry();
      const now = new Date();
      const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(6.9);
      expect(diffDays).toBeLessThan(7.1);
    });
  });
});
