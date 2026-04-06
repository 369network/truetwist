import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { ExportService } from '@/lib/analytics/export-service';

const exportService = new ExportService();

// GET /api/v1/analytics/export - Export analytics to CSV/JSON
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'csv') as 'csv' | 'json';
    const range = searchParams.get('range') || '30d';
    const businessId = searchParams.get('businessId') || undefined;
    const platforms = searchParams.get('platforms')?.split(',').filter(Boolean);

    if (!['csv', 'json'].includes(format)) {
      throw Errors.badRequest('Format must be csv or json');
    }

    const days = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 }[range] || 30;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);

    const result = await exportService.exportAnalytics({
      userId: user.sub,
      businessId,
      startDate,
      endDate,
      format,
      platforms,
    });

    return new NextResponse(result.content, {
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
