export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { listTemplates, getTemplate } from '@/lib/ai/video-templates';
import { errorResponse } from '@/lib/errors';

// GET /api/v1/ai/generate/video/templates — List all video templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (templateId) {
      const template = getTemplate(templateId as any);
      if (!template) {
        return NextResponse.json({ error: { error: 'Template not found', code: 'NOT_FOUND' } }, { status: 404 });
      }
      return NextResponse.json({ data: template });
    }

    const templates = listTemplates();
    return NextResponse.json({ data: templates });
  } catch (error) {
    return errorResponse(error);
  }
}
