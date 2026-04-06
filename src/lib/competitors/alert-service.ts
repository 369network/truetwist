import { prisma } from '@/lib/prisma';
import type { AlertType, AlertSeverity } from './types';

/**
 * Retrieves alerts for a business, optionally filtered by type and read status.
 */
export async function getAlerts(
  businessId: string,
  options: {
    alertType?: AlertType;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { alertType, unreadOnly = false, limit = 50, offset = 0 } = options;

  const where: Record<string, unknown> = { businessId };
  if (alertType) where.alertType = alertType;
  if (unreadOnly) where.readAt = null;

  const [alerts, total] = await Promise.all([
    prisma.competitorAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.competitorAlert.count({ where }),
  ]);

  return { alerts, total };
}

/**
 * Marks one or more alerts as read.
 */
export async function markAlertsRead(alertIds: string[]): Promise<number> {
  const result = await prisma.competitorAlert.updateMany({
    where: { id: { in: alertIds }, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/**
 * Marks all alerts for a business as read.
 */
export async function markAllAlertsRead(businessId: string): Promise<number> {
  const result = await prisma.competitorAlert.updateMany({
    where: { businessId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/**
 * Creates a competitor alert.
 */
export async function createAlert(data: {
  businessId: string;
  competitorId?: string;
  competitorAccountId?: string;
  alertType: AlertType;
  title: string;
  description: string;
  severity?: AlertSeverity;
  metadata?: Record<string, unknown>;
}) {
  return prisma.competitorAlert.create({
    data: {
      businessId: data.businessId,
      competitorId: data.competitorId,
      competitorAccountId: data.competitorAccountId,
      alertType: data.alertType,
      title: data.title,
      description: data.description,
      severity: data.severity || 'info',
      metadata: (data.metadata || {}) as any,
    },
  });
}

/**
 * Returns a summary of unread alert counts by type for a business.
 */
export async function getAlertSummary(businessId: string) {
  const alerts = await prisma.competitorAlert.groupBy({
    by: ['alertType'],
    where: { businessId, readAt: null },
    _count: true,
  });

  const summary: Record<string, number> = {};
  for (const alert of alerts) {
    summary[alert.alertType] = alert._count;
  }

  return {
    total: Object.values(summary).reduce((s, v) => s + v, 0),
    byType: summary,
  };
}
