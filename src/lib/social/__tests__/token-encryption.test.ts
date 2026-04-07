import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';
import { encryptToken, decryptToken } from '../token-encryption';

const TEST_KEY = randomBytes(32).toString('hex');

beforeEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
});

describe('token-encryption', () => {
  describe('encryptToken / decryptToken', () => {
    it('round-trip: encrypting then decrypting returns the original plaintext', () => {
      const plaintext = 'my-secret-access-token';
      const ciphertext = encryptToken(plaintext);
      expect(decryptToken(ciphertext)).toBe(plaintext);
    });

    it('different plaintexts produce different ciphertexts', () => {
      const ct1 = encryptToken('token-alpha');
      const ct2 = encryptToken('token-beta');
      expect(ct1).not.toBe(ct2);
    });

    it('decryption with a wrong key throws', () => {
      const ciphertext = encryptToken('some-token');
      // Swap to a different key before decrypting
      process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('hex');
      expect(() => decryptToken(ciphertext)).toThrow();
    });

    it('throws when TOKEN_ENCRYPTION_KEY is missing', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      expect(() => encryptToken('hello')).toThrow('TOKEN_ENCRYPTION_KEY environment variable is required');
    });

    it('throws when TOKEN_ENCRYPTION_KEY has invalid length (not 32 bytes)', () => {
      // 30 bytes = 60 hex chars — too short
      process.env.TOKEN_ENCRYPTION_KEY = randomBytes(30).toString('hex');
      expect(() => encryptToken('hello')).toThrow('TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    });

    it('output is valid base64', () => {
      const ciphertext = encryptToken('check-base64');
      // A valid base64 string only contains A-Z, a-z, 0-9, +, /, and = for padding
      expect(ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('output length is at least IV_LENGTH + AUTH_TAG_LENGTH (28 bytes) when decoded', () => {
      const IV_LENGTH = 12;
      const AUTH_TAG_LENGTH = 16;
      const ciphertext = encryptToken('x');
      const decoded = Buffer.from(ciphertext, 'base64');
      expect(decoded.length).toBeGreaterThanOrEqual(IV_LENGTH + AUTH_TAG_LENGTH);
    });

    it('empty string round-trip works', () => {
      const ciphertext = encryptToken('');
      expect(decryptToken(ciphertext)).toBe('');
    });

    it('long string round-trip works', () => {
      const long = randomBytes(4096).toString('base64');
      const ciphertext = encryptToken(long);
      expect(decryptToken(ciphertext)).toBe(long);
    });

    it('each encryption of the same plaintext produces a different ciphertext (random IV)', () => {
      const plaintext = 'same-plaintext';
      const ct1 = encryptToken(plaintext);
      const ct2 = encryptToken(plaintext);
      expect(ct1).not.toBe(ct2);
    });
  });
});
