import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before any module import that uses it
vi.mock('@/lib/prisma', () => ({
  prisma: {
    postSchedule: {
      findMany: vi.fn(),
    },
    socialAccount: {
      findMany: vi.fn(),
    },
    analyticsReport: {
      create: vi.fn(),
    },
  },
}));

// Mock OpenAI as specified in the task
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: vi.fn() } };
  },
}));

import { ReportService } from '@/lib/analytics/report-service';
import { prisma } from '@/lib/prisma';

// Re-implement private helpers for direct unit testing
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const mockPrisma = vi.mocked(prisma);

// ---------------------------------------------------------------------------
// capitalize (private helper — reimplemented above)
// ---------------------------------------------------------------------------

describe('capitalize', () => {
  it('uppercases the first character of a normal lowercase string', () => {
    expect(capitalize('weekly')).toBe('Weekly');
  });

  it('uppercases the first character and leaves the rest unchanged', () => {
    expect(capitalize('monthly report')).toBe('Monthly report');
  });

  it('returns an empty string unchanged', () => {
    expect(capitalize('')).toBe('');
  });

  it('handles a single lowercase character', () => {
    expect(capitalize('c')).toBe('C');
  });

  it('handles a string that is already capitalised', () => {
    expect(capitalize('Competitor')).toBe('Competitor');
  });

  it('handles a string starting with a digit', () => {
    expect(capitalize('123abc')).toBe('123abc');
  });
});

// ---------------------------------------------------------------------------
// getISOWeek (private helper — reimplemented above)
// ---------------------------------------------------------------------------

describe('getISOWeek', () => {
  it('returns week 1 for 2024-01-01 (Monday)', () => {
    // 2024-01-01 is a Monday — ISO week 1
    expect(getISOWeek(new Date('2024-01-01'))).toBe(1);
  });

  it('returns week 52 for 2023-12-31 (Sunday)', () => {
    // 2023-12-31 is a Sunday and belongs to ISO week 52 of 2023
    expect(getISOWeek(new Date('2023-12-31'))).toBe(52);
  });

  it('returns week 1 for 2020-01-01 (Wednesday)', () => {
    // 2020-01-01 is a Wednesday — ISO week 1
    expect(getISOWeek(new Date('2020-01-01'))).toBe(1);
  });

  it('returns week 53 for 2020-12-31 (Thursday)', () => {
    // 2020 is a long year — 2020-12-31 is ISO week 53
    expect(getISOWeek(new Date('2020-12-31'))).toBe(53);
  });

  it('returns a value between 1 and 53 for any date', () => {
    const dates = [
      new Date('2026-03-15'),
      new Date('2025-07-04'),
      new Date('2024-11-28'),
      new Date('2023-06-01'),
    ];
    for (const d of dates) {
      const week = getISOWeek(d);
      expect(week).toBeGreaterThanOrEqual(1);
      expect(week).toBeLessThanOrEqual(53);
    }
  });
});

// ---------------------------------------------------------------------------
// ReportService.generateReport
// ---------------------------------------------------------------------------

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReportService();

    // Default: no schedules, no accounts, report creation returns an id
    mockPrisma.postSchedule.findMany.mockResolvedValue([]);
    mockPrisma.socialAccount.findMany.mockResolvedValue([]);
    mockPrisma.analyticsReport.create.mockResolvedValue({ id: 'report-123' } as any);
  });

  describe('weekly report', () => {
    it('returns the report id created by prisma', async () => {
      const id = await service.generateReport('user-1', 'weekly');
      expect(id).toBe('report-123');
    });

    it('creates the report with type "weekly" and a W-prefixed period label', async () => {
      await service.generateReport('user-1', 'weekly');

      const createData = mockPrisma.analyticsReport.create.mock.calls[0][0].data;
      expect(createData.reportType).toBe('weekly');
      expect(createData.period).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('creates the report with a title starting with "Weekly"', async () => {
      await service.generateReport('user-1', 'weekly');

      const createData = mockPrisma.analyticsReport.create.mock.calls[0][0].data;
      expect(createData.title).toMatch(/^Weekly Performance Report/);
    });

    it('passes the userId to the created report', async () => {
      await service.generateReport('user-42', 'weekly');

      const createData = mockPrisma.analyticsReport.create.mock.calls[0][0].data;
      expect(createData.userId).toBe('user-42');
    });

    it('sets businessId to null when not provided', async () => {
      await service.generateReport('user-1', 'weekly');

      const createData = mockPrisma.analyticsReport.create.mock.calls[0][0].data;
      expect(createData.businessId).toBeNull();
    });

    it('passes the businessId through when provided', async () => {
      await service.generateReport('user-1', 'weekly', 'biz-99');

      const createData = mockPrisma.analyticsReport.create.mock.calls[0][0].data;
      expect(createData.businessId).toBe('biz-99');
    });
  });

  describe('monthly report', () => {
    it('creates the report with type "monthly" and a YYYY-MM period label', async () => {
      await service.generateReport('user-1', 'monthly');

      const createData = mockPrisma.analyticsReport.create.mock.calls[0][0].data;
      expect(createData.reportType).toBe('monthly');
      expect(createData.period).toMatch(/^\d{4}-\d{2}$/);
    });

    it('creates the report with a title starting with "Monthly"', async () => {
      await service.generateReport('user-1', 'monthly');

      const createData = mockPrisma.analyticsReport.create.mock.calls[0][0].data;
      expect(createData.title).toMatch(/^Monthly Performance Report/);
    });

    it('stores zero-value metrics when no schedule data exists', async () => {
      await service.generateReport('user-1', 'monthly');

      const createData = mockPrisma.analyticsReport.create.mock.calls[0][0].data;
      expect(createData.metrics.impressions).toBe(0);
      expect(createData.metrics.engagements).toBe(0);
      expect(createData.metrics.postCount).toBe(0);
    });
  });

  describe('competitor report', () => {
    it('creates the report with type "competitor" and a competitor- prefixed period label', async () => {
      await service.generateReport('user-1', 'competitor');

      const createData = mockPrisma.analyticsReport.create.mock.calls[0][0].data;
      expect(createData.reportType).toBe('competitor');
      expect(createData.period).toMatch(/^competitor-\d{4}-\d{2}-\d{2}$/);
    });

    it('creates the report with a title starting with "Competitor"', async () => {
      await service.generateReport('user-1', 'competitor');

      const createData = mockPrisma.analyticsReport.create.mock.calls[0][0].data;
      expect(createData.title).toMatch(/^Competitor Performance Report/);
    });
  });

  describe('AI fallback when OpenAI is unavailable', () => {
    it('still creates the report and includes a non-empty summary on AI failure', async () => {
      // OpenAI mock always rejects to simulate unavailability
      const OpenAI = (await import('openai')).default;
      const instance = new OpenAI();
      vi.mocked(instance.chat.completions.create).mockRejectedValue(new Error('API error'));

      await service.generateReport('user-1', 'weekly');

      const createData = mockPrisma.analyticsReport.create.mock.calls[0][0].data;
      expect(typeof createData.summary).toBe('string');
      expect(createData.summary.length).toBeGreaterThan(0);
      expect(Array.isArray(createData.insights)).toBe(true);
      expect(Array.isArray(createData.recommendations)).toBe(true);
    });
  });

  describe('metrics aggregation', () => {
    it('sums impressions and engagements from schedule analytics', async () => {
      mockPrisma.postSchedule.findMany.mockResolvedValue([
        {
          id: 's1',
          post: { contentText: 'Hello world', contentType: 'text' },
          socialAccount: { platform: 'instagram', followerCount: 1000 },
          analytics: [{
            impressions: 500,
            reach: 400,
            likes: 20,
            comments: 5,
            shares: 3,
            saves: 2,
            clicks: 10,
            engagementRate: 6.0,
            fetchedAt: new Date(),
          }],
        },
        {
          id: 's2',
          post: { contentText: 'Another post', contentType: 'image' },
          socialAccount: { platform: 'twitter', followerCount: 800 },
          analytics: [{
            impressions: 300,
            reach: 250,
            likes: 15,
            comments: 3,
            shares: 1,
            saves: 1,
            clicks: 5,
            engagementRate: 6.67,
            fetchedAt: new Date(),
          }],
        },
      ] as any);

      mockPrisma.socialAccount.findMany.mockResolvedValue([
        { followerCount: 1000 },
        { followerCount: 800 },
      ] as any);

      await service.generateReport('user-1', 'weekly');

      const createData = mockPrisma.analyticsReport.create.mock.calls[0][0].data;
      expect(createData.metrics.impressions).toBe(800);
      expect(createData.metrics.postCount).toBe(2);
      expect(createData.metrics.followerCount).toBe(1800);
    });
  });
});
