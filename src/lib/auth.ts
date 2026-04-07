import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import type { JwtPayload, RefreshTokenPayload, PlanTier } from "@/types";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let _jwtSecret: string | undefined;
let _jwtRefreshSecret: string | undefined;

function getJwtSecret(): string {
  if (!_jwtSecret) _jwtSecret = getRequiredEnv("JWT_SECRET");
  return _jwtSecret;
}

function getJwtRefreshSecret(): string {
  if (!_jwtRefreshSecret)
    _jwtRefreshSecret = getRequiredEnv("JWT_REFRESH_SECRET");
  return _jwtRefreshSecret;
}

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(
  userId: string,
  email: string,
  plan: PlanTier,
): string {
  return jwt.sign(
    { sub: userId, email, plan } as Omit<JwtPayload, "iat" | "exp">,
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
}

export function generateRefreshToken(userId: string): {
  token: string;
  jti: string;
} {
  const jti = uuidv4();
  const token = jwt.sign(
    { sub: userId, jti } as Omit<RefreshTokenPayload, "iat" | "exp">,
    getJwtRefreshSecret(),
    { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` },
  );
  return { token, jti };
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, getJwtRefreshSecret()) as RefreshTokenPayload;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return expiry;
}
