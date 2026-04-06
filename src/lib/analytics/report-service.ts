import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

const openai = new OpenAI();

export type ReportType = 'weekly' | 'monthly' | 'competitor';

interface ReportMetrics {
  impressions: number;
  reach: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  followerCount: number;
  followerGrowth: number;
  postCount: number;
  engagementRate: number;
  topPosts: Array<{ title: string; platform: string; engagementRate: number }>;
  platformBreakdown: Record<string, { impressions: number; engagements: number; posts: number }>;
}

export class ReportService {
  async generateReport(
    userId: string,
    reportType: ReportType,
    businessId?: string
  ): Promise<string> {
    const now = new Date();
    let periodLabel: string;
    let periodStart: Date;
    let periodEnd: Date;

    if (reportType === 'weekly') {
      periodEnd = new Date(now);
      periodEnd.setUTCHours(23, 59, 59, 999);
      periodStart = new Date(periodEnd);
      periodStart.setUTCDate(periodStart.getUTCDate() - 7);
      periodStart.setUTCHours(0, 0, 0, 0);
      const weekNum = getISOWeek(now);
      periodLabel = `${now.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    } else if (reportType === 'monthly') {
      periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      periodLabel = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    } else {
      // Competitor report: last 30 days
      periodEnd = new Date(now);
      periodStart = new Date(now);
      periodStart.setUTCDate(periodStart.getUTCDate() - 30);
      periodLabel = `competitor-${now.toISOString().slice(0, 10)}`;
    }

    const metrics = await this.collectMetrics(userId, periodStart, periodEnd, businessId);

    // Generate AI summary
    const aiResult = await this.generateAISummary(reportType, periodLabel, metrics);

    const report = await prisma.analyticsReport.create({
      data: {
        userId,
        businessId: businessId ?? null,
        reportType,
        title: `${capitalize(reportType)} Performance Report - ${periodLabel}`,
        period: periodLabel,
        summary: aiResult.summary,
        insights: aiResult.insights,
        recommendations: aiResult.recommendations,
        metrics: JSON.parse(JSON.stringify(metrics)),
      },
    });

    return report.id;
  }

  private async collectMetrics(
    userId: string,
    start: Date,
    end: Date,
    businessId?: string
  ): Promise<ReportMetrics> {
    const postWhere: Record<string, unknown> = { userId };
    if (businessId) postWhere.businessId = businessId;

    const schedules = await prisma.postSchedule.findMany({
      where: {
        post: postWhere,
        scheduledAt: { gte: start, lte: end },
        status: { in: ['posted', 'posting'] },
      },
      include: {
        post: { select: { contentText: true, contentType: true } },
        socialAccount: { select: { platform: true, followerCount: true } },
        analytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
    });

    let impressions = 0, reach = 0, engagements = 0;
    let likes = 0, comments = 0, shares = 0, saves = 0, clicks = 0;
    const platformBreakdown: Record<string, { impressions: number; engagements: number; posts: number }> = {};
    const topPosts: Array<{ title: string; platform: string; engagementRate: number }> = [];

    for (const schedule of schedules) {
      const a = schedule.analytics[0];
      if (!a) continue;

      impressions += a.impressions;
      reach += a.reach;
      likes += a.likes;
      comments += a.comments;
      shares += a.shares;
      saves += a.saves;
      clicks += a.clicks;
      engagements += a.likes + a.comments + a.shares + a.saves;

      const p = schedule.socialAccount.platform;
      if (!platformBreakdown[p]) platformBreakdown[p] = { impressions: 0, engagements: 0, posts: 0 };
      platformBreakdown[p].impressions += a.impressions;
      platformBreakdown[p].engagements += a.likes + a.comments + a.shares;
      platformBreakdown[p].posts++;

      topPosts.push({
        title: schedule.post.contentText?.slice(0, 80) || 'Untitled',
        platform: p,
        engagementRate: a.engagementRate,
      });
    }

    topPosts.sort((a, b) => b.engagementRate - a.engagementRate);

    const accounts = await prisma.socialAccount.findMany({
      where: { userId, isActive: true },
      select: { followerCount: true },
    });
    const followerCount = accounts.reduce((sum, a) => sum + a.followerCount, 0);

    return {
      impressions,
      reach,
      engagements,
      likes,
      comments,
      shares,
      saves,
      clicks,
      followerCount,
      followerGrowth: 0,
      postCount: schedules.length,
      engagementRate: impressions > 0 ? (engagements / impressions) * 100 : 0,
      topPosts: topPosts.slice(0, 5),
      platformBreakdown,
    };
  }

  private async generateAISummary(
    reportType: ReportType,
    period: string,
    metrics: ReportMetrics
  ): Promise<{ summary: string; insights: string[]; recommendations: string[] }> {
    const prompt = `You are a social media analytics expert. Generate a concise ${reportType} performance report for period ${period}.

Metrics:
- Total Impressions: ${metrics.impressions.toLocaleString()}
- Total Reach: ${metrics.reach.toLocaleString()}
- Total Engagements: ${metrics.engagements.toLocaleString()}
- Engagement Rate: ${metrics.engagementRate.toFixed(2)}%
- Followers: ${metrics.followerCount.toLocaleString()}
- Posts Published: ${metrics.postCount}
- Likes: ${metrics.likes}, Comments: ${metrics.comments}, Shares: ${metrics.shares}

Platform Breakdown:
${Object.entries(metrics.platformBreakdown).map(([p, d]) => `- ${p}: ${d.posts} posts, ${d.impressions} impressions, ${d.engagements} engagements`).join('\n')}

Top Posts:
${metrics.topPosts.map((p, i) => `${i + 1}. "${p.title}" (${p.platform}) - ${p.engagementRate.toFixed(2)}% engagement`).join('\n')}

Return JSON with:
- "summary": 2-3 sentence executive summary
- "insights": array of 3-5 key insights
- "recommendations": array of 3-5 actionable recommendations`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return {
          summary: parsed.summary || 'Report generated successfully.',
          insights: parsed.insights || [],
          recommendations: parsed.recommendations || [],
        };
      }
    } catch {
      // Fallback if AI is unavailable
    }

    return {
      summary: `${capitalize(reportType)} report for ${period}: ${metrics.postCount} posts published with ${metrics.engagementRate.toFixed(2)}% average engagement rate across ${Object.keys(metrics.platformBreakdown).length} platforms.`,
      insights: [
        `Published ${metrics.postCount} posts reaching ${metrics.impressions.toLocaleString()} impressions`,
        `Overall engagement rate: ${metrics.engagementRate.toFixed(2)}%`,
        `Total follower count: ${metrics.followerCount.toLocaleString()}`,
      ],
      recommendations: [
        'Analyze top-performing content types and create more similar content',
        'Experiment with posting times to optimize engagement',
        'Focus on platforms showing the highest engagement rates',
      ],
    };
  }
}

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
