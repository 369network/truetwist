export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { CreatifyService } from '@/lib/ai/creatify-service';

// GET /api/v1/ai/templates/video — List available Creatify video ad templates
export async function GET(request: NextRequest) {
  try {
    getAuthUser(request);

    const templates = await CreatifyService.listTemplates();

    return NextResponse.json({
      data: templates,
      pagination: { total: templates.length },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
