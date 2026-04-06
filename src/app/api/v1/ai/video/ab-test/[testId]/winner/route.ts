export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { completeTest, checkSignificance, getVideoAbTest } from '@/lib/ai/video-ab-test-service';

const selectWinnerSchema = z.object({
  winnerId: z.string().uuid().optional(), // omit for auto-pick
});

// POST /api/v1/ai/video/ab-test/:testId/winner — Select winner (manual or auto)
export async function POST(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const parsed = selectWinnerSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.flatten());

    const test = await prisma.videoAbTest.findFirst({
      where: { id: params.testId, userId: user.sub },
    });
    if (!test) throw Errors.notFound('Video A/B Test');

    if (!['running', 'generating'].includes(test.status)) {
      throw Errors.badRequest('Can only select winner for running tests');
    }

    await completeTest(params.testId, user.sub, parsed.data.winnerId);

    const significance = await checkSignificance(params.testId);
    const updated = await getVideoAbTest(params.testId, user.sub);

    return NextResponse.json({ data: { ...updated, significance } });
  } catch (error) {
    return errorResponse(error);
  }
}
