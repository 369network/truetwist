import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { ReportService } from '@/lib/analytics/report-service';

const reportService = new ReportService();

// GET /api/v1/analytics/reports - List reports
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const where: Record<string, unknown> = { userId: user.sub };
    if (reportType) where.reportType = reportType;

    const reports = await prisma.analyticsReport.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ data: reports });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/v1/analytics/reports - Generate a new report
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const { reportType, businessId } = body;

    if (!['weekly', 'monthly', 'competitor'].includes(reportType)) {
      throw Errors.badRequest('reportType must be weekly, monthly, or competitor');
    }

    const reportId = await reportService.generateReport(user.sub, reportType, businessId);

    const report = await prisma.analyticsReport.findUniqueOrThrow({
      where: { id: reportId },
    });

    return NextResponse.json({ data: report }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
