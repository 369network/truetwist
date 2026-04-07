import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

type AuditSeverity = "info" | "warning" | "critical";

interface AuditEntry {
  userId?: string | null;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
}

/**
 * Extract client IP and User-Agent from a Next.js request.
 */
export function extractRequestMeta(request: NextRequest): {
  ipAddress: string;
  userAgent: string;
} {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return { ipAddress, userAgent };
}

/**
 * Write an audit log entry. Fire-and-forget — never blocks the request.
 */
export function auditLog(entry: AuditEntry): void {
  prisma.auditLog
    .create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        resource: entry.resource ?? null,
        resourceId: entry.resourceId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: (entry.metadata ?? {}) as any, // Cast to Prisma.JsonValue
        severity: entry.severity ?? "info",
      },
    })
    .catch((err: unknown) => {
      // Never let audit failures break the application
      console.error("[audit] Failed to write audit log:", err);
    });
}

/**
 * Convenience: log from a request context.
 */
export function auditFromRequest(
  request: NextRequest,
  entry: Omit<AuditEntry, "ipAddress" | "userAgent">,
): void {
  const { ipAddress, userAgent } = extractRequestMeta(request);
  auditLog({ ...entry, ipAddress, userAgent });
}

// Common audit actions
export const AuditActions = {
  // Auth
  LOGIN_SUCCESS: "auth.login",
  LOGIN_FAILED: "auth.login_failed",
  LOGOUT: "auth.logout",
  REGISTER: "auth.register",
  PASSWORD_RESET_REQUEST: "auth.password_reset_request",
  PASSWORD_RESET_COMPLETE: "auth.password_reset_complete",
  PASSWORD_CHANGED: "auth.password_changed",
  TOKEN_REFRESH: "auth.token_refresh",

  // User
  USER_UPDATED: "user.update",
  USER_DELETED: "user.delete",

  // API Keys
  APIKEY_CREATED: "apikey.create",
  APIKEY_REVOKED: "apikey.revoke",
  APIKEY_ROTATED: "apikey.rotate",

  // Team
  TEAM_CREATED: "team.create",
  MEMBER_INVITED: "team.member_invited",
  MEMBER_REMOVED: "team.member_removed",
  ROLE_CHANGED: "team.role_changed",

  // Business / Data
  BUSINESS_CREATED: "business.create",
  BUSINESS_DELETED: "business.delete",
  DATA_EXPORTED: "data.export",

  // Admin
  ADMIN_ROLE_CHANGE: "admin.role_change",
  SETTINGS_CHANGED: "settings.change",
} as const;
