/**
 * Unified audit logging for ad operations.
 * Standardizes audit trail across all ad API routes.
 */

import { prisma } from "@/lib/prisma";
import type { AdPlatform } from "./types";

type AdAuditAction =
  | "account_connected"
  | "account_disconnected"
  | "campaign_created"
  | "campaign_updated"
  | "campaign_paused"
  | "campaign_resumed"
  | "adset_created"
  | "ad_created"
  | "metrics_synced"
  | "budget_updated"
  | "api_error"
  | "rate_limit_hit"
  | "token_refreshed";

type AdEntityType =
  | "ad_account"
  | "campaign"
  | "ad_set"
  | "ad"
  | "metric";

interface AuditLogParams {
  userId: string;
  adAccountId: string;
  action: AdAuditAction;
  entityType: AdEntityType;
  entityId: string;
  platform?: AdPlatform;
  details?: Record<string, unknown>;
}

/**
 * Writes an audit log entry for an ad operation.
 * Non-blocking — errors are caught and logged rather than thrown.
 */
export async function logAdAudit(params: AuditLogParams): Promise<void> {
  try {
    await prisma.adAuditLog.create({
      data: {
        userId: params.userId,
        adAccountId: params.adAccountId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: {
          ...(params.platform ? { platform: params.platform } : {}),
          ...params.details,
        },
      },
    });
  } catch (err) {
    console.error("[AdAudit] Failed to write audit log:", err);
  }
}

/**
 * Logs an ad platform API error with full context.
 */
export async function logAdApiError(params: {
  userId: string;
  adAccountId: string;
  platform: AdPlatform;
  operation: string;
  statusCode?: number;
  error: string;
  entityType?: AdEntityType;
  entityId?: string;
}): Promise<void> {
  await logAdAudit({
    userId: params.userId,
    adAccountId: params.adAccountId,
    action: "api_error",
    entityType: params.entityType ?? "ad_account",
    entityId: params.entityId ?? params.adAccountId,
    platform: params.platform,
    details: {
      operation: params.operation,
      statusCode: params.statusCode,
      error: params.error,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Logs a rate limit event for monitoring dashboards.
 */
export async function logAdRateLimitHit(params: {
  userId: string;
  adAccountId: string;
  platform: AdPlatform;
  retryAfterMs: number;
}): Promise<void> {
  await logAdAudit({
    userId: params.userId,
    adAccountId: params.adAccountId,
    action: "rate_limit_hit",
    entityType: "ad_account",
    entityId: params.adAccountId,
    platform: params.platform,
    details: {
      retryAfterMs: params.retryAfterMs,
      timestamp: new Date().toISOString(),
    },
  });
}
