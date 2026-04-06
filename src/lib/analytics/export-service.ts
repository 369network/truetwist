import { prisma } from '@/lib/prisma';

export type ExportFormat = 'csv' | 'json';

interface ExportOptions {
  userId: string;
  businessId?: string;
  startDate: Date;
  endDate: Date;
  format: ExportFormat;
  platforms?: string[];
}

export class ExportService {
  async exportAnalytics(options: ExportOptions): Promise<{ content: string; contentType: string; filename: string }> {
    const { userId, businessId, startDate, endDate, format, platforms } = options;

    const postWhere: Record<string, unknown> = { userId };
    if (businessId) postWhere.businessId = businessId;

    const schedules = await prisma.postSchedule.findMany({
      where: {
        post: postWhere,
        scheduledAt: { gte: startDate, lte: endDate },
        status: { in: ['posted', 'posting'] },
        ...(platforms?.length ? { socialAccount: { platform: { in: platforms } } } : {}),
      },
      include: {
        post: { select: { id: true, contentText: true, contentType: true } },
        socialAccount: { select: { platform: true, accountName: true } },
        analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    const rows = schedules.map(s => {
      const a = s.analytics[0];
      return {
        date: s.scheduledAt.toISOString().slice(0, 10),
        platform: s.socialAccount.platform,
        account: s.socialAccount.accountName || '',
        content: (s.post.contentText || '').slice(0, 100).replace(/[\n\r,]/g, ' '),
        contentType: s.post.contentType,
        impressions: a?.impressions ?? 0,
        reach: a?.reach ?? 0,
        likes: a?.likes ?? 0,
        comments: a?.comments ?? 0,
        shares: a?.shares ?? 0,
        saves: a?.saves ?? 0,
        clicks: a?.clicks ?? 0,
        engagementRate: a?.engagementRate?.toFixed(4) ?? '0',
      };
    });

    const dateStr = startDate.toISOString().slice(0, 10);

    if (format === 'csv') {
      return {
        content: this.toCSV(rows),
        contentType: 'text/csv',
        filename: `analytics-export-${dateStr}.csv`,
      };
    }

    return {
      content: JSON.stringify(rows, null, 2),
      contentType: 'application/json',
      filename: `analytics-export-${dateStr}.json`,
    };
  }

  private toCSV(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const csvRows = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => {
          const val = String(row[h] ?? '');
          return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(',')
      ),
    ];
    return csvRows.join('\n');
  }
}
