import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  encryptToken,
  decryptToken,
  encryptTokenForDb,
  decryptTokenFromDb,
} from "../encryption";

// Mock environment variables
const mockEncryptionKey =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 64 hex chars = 32 bytes

describe("Ad Token Encryption", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AD_TOKEN_ENCRYPTION_KEY = mockEncryptionKey;
  });

  afterEach(() => {
    delete process.env.AD_TOKEN_ENCRYPTION_KEY;
  });

  describe("encryptToken", () => {
    it("should encrypt a token and return encrypted data with IV", () => {
      const token = "test-access-token-12345";
      const result = encryptToken(token);

      expect(result).toHaveProperty("encrypted");
      expect(result).toHaveProperty("iv");
      expect(result.encrypted).toBeTruthy();
      expect(result.iv).toBeTruthy();
      expect(result.iv).toHaveLength(24); // 12 bytes in hex = 24 chars
    });

    it("should produce different IVs for each encryption", () => {
      const token = "same-token";
      const result1 = encryptToken(token);
      const result2 = encryptToken(token);

      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.encrypted).not.toBe(result2.encrypted);
    });
  });

  describe("decryptToken", () => {
    it("should decrypt an encrypted token", () => {
      const originalToken = "test-access-token-12345";
      const { encrypted, iv } = encryptToken(originalToken);

      const decrypted = decryptToken(encrypted, iv);
      expect(decrypted).toBe(originalToken);
    });

    it("should throw error with invalid IV", () => {
      const originalToken = "test-access-token-12345";
      const { encrypted } = encryptToken(originalToken);
      const invalidIv = "not-a-valid-hex-string";

      expect(() => decryptToken(encrypted, invalidIv)).toThrow();
    });

    it("should throw error with tampered encrypted data", () => {
      const originalToken = "test-access-token-12345";
      const { encrypted, iv } = encryptToken(originalToken);
      const tampered = encrypted.slice(0, -10) + "deadbeef"; // Tamper with data

      expect(() => decryptToken(tampered, iv)).toThrow();
    });
  });

  describe("encryptTokenForDb / decryptTokenFromDb", () => {
    it("should encrypt and decrypt token for database storage", () => {
      const token = "long-lived-meta-token-abc123";
      const { encryptedToken, iv } = encryptTokenForDb(token);

      expect(encryptedToken).toBeTruthy();
      expect(iv).toBeTruthy();

      const decrypted = decryptTokenFromDb(encryptedToken, iv);
      expect(decrypted).toBe(token);
    });

    it("should handle special characters in tokens", () => {
      const token = 'token-with-special-chars!@#$%^&*()_+{}|:"<>?`~[]\\;,./';
      const { encryptedToken, iv } = encryptTokenForDb(token);

      const decrypted = decryptTokenFromDb(encryptedToken, iv);
      expect(decrypted).toBe(token);
    });

    it("should handle empty token", () => {
      const token = "";
      const { encryptedToken, iv } = encryptTokenForDb(token);

      const decrypted = decryptTokenFromDb(encryptedToken, iv);
      expect(decrypted).toBe(token);
    });
  });

  describe("environment validation", () => {
    it("should throw error when AD_TOKEN_ENCRYPTION_KEY is missing", () => {
      delete process.env.AD_TOKEN_ENCRYPTION_KEY;

      expect(() => encryptToken("test")).toThrow(
        "Missing required environment variable: AD_TOKEN_ENCRYPTION_KEY",
      );
    });

    it("should throw error when AD_TOKEN_ENCRYPTION_KEY is wrong length", () => {
      process.env.AD_TOKEN_ENCRYPTION_KEY = "tooshort"; // Not 64 hex chars

      expect(() => encryptToken("test")).toThrow(
        "AD_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)",
      );
    });

    it("should throw error when AD_TOKEN_ENCRYPTION_KEY is not hex", () => {
      process.env.AD_TOKEN_ENCRYPTION_KEY = "x".repeat(64); // Not valid hex

      expect(() => encryptToken("test")).toThrow();
    });
  });

  describe("encryption consistency", () => {
    it("should maintain encryption/decryption consistency across multiple calls", () => {
      const token = "consistent-token-test";
      const { encryptedToken, iv } = encryptTokenForDb(token);

      // Decrypt multiple times - should always work
      for (let i = 0; i < 5; i++) {
        const decrypted = decryptTokenFromDb(encryptedToken, iv);
        expect(decrypted).toBe(token);
      }
    });

    it("should handle very long tokens", () => {
      const longToken = "a".repeat(10000); // 10KB token
      const { encryptedToken, iv } = encryptTokenForDb(longToken);

      const decrypted = decryptTokenFromDb(encryptedToken, iv);
      expect(decrypted).toBe(longToken);
      expect(decrypted.length).toBe(10000);
    });
  });
});
