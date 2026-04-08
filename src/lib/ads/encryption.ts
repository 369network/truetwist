import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let _encryptionKey: Buffer | undefined;

function getEncryptionKey(): Buffer {
  if (!_encryptionKey) {
    const key = getRequiredEnv("AD_TOKEN_ENCRYPTION_KEY");
    // Key must be 32 bytes for AES-256-GCM
    if (key.length !== 64) {
      throw new Error(
        "AD_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)",
      );
    }
    _encryptionKey = Buffer.from(key, "hex");
  }
  return _encryptionKey;
}

export function encryptToken(token: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // 12 bytes for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Combine IV + authTag + encrypted data
  const result = iv.toString("hex") + authTag.toString("hex") + encrypted;

  return { encrypted: result, iv: iv.toString("hex") };
}

export function decryptToken(encryptedData: string, ivHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");

  // Extract auth tag (last 32 hex chars = 16 bytes)
  const authTag = Buffer.from(encryptedData.slice(-32), "hex");
  const encrypted = encryptedData.slice(0, -32);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// For storing in database with separate IV field
export function encryptTokenForDb(token: string): {
  encryptedToken: string;
  iv: string;
} {
  const { encrypted, iv } = encryptToken(token);
  return { encryptedToken: encrypted, iv };
}

export function decryptTokenFromDb(encryptedToken: string, iv: string): string {
  return decryptToken(encryptedToken, iv);
}
