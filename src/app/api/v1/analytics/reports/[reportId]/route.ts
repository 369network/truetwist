import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

// GET /api/v1/analytics/reports/:reportId - Get a single report
export async function GET(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const user = getAuthUser(request);

    const report = await prisma.analyticsReport.findFirst({
      where: { id: params.reportId, userId: user.sub },
    });

    if (!report) throw Errors.notFound('Report');

    return NextResponse.json({ data: report });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/analytics/reports/:reportId - Delete a report
export async function DELETE(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const user = getAuthUser(request);

    const report = await prisma.analyticsReport.findFirst({
      where: { id: params.reportId, userId: user.sub },
    });

    if (!report) throw Errors.notFound('Report');

    await prisma.analyticsReport.delete({ where: { id: params.reportId } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
