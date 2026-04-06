import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { AbTestService } from '@/lib/analytics/ab-test-service';

const abTestService = new AbTestService();

// GET /api/v1/ab-tests/:testId - Get test with significance check
export async function GET(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
  try {
    const user = getAuthUser(request);

    const test = await prisma.abTest.findFirst({
      where: { id: params.testId, userId: user.sub },
      include: { variants: true },
    });

    if (!test) throw Errors.notFound('A/B Test');

    let significance = null;
    if (test.status === 'running') {
      significance = await abTestService.checkSignificance(params.testId);
    }

    return NextResponse.json({ data: { ...test, significance } });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/v1/ab-tests/:testId - Update test status (start, complete, cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const { action } = body; // start, complete, cancel

    const test = await prisma.abTest.findFirst({
      where: { id: params.testId, userId: user.sub },
    });
    if (!test) throw Errors.notFound('A/B Test');

    let result;
    switch (action) {
      case 'start':
        if (test.status !== 'draft') throw Errors.badRequest('Can only start draft tests');
        await abTestService.startTest(params.testId, user.sub);
        result = { status: 'running' };
        break;
      case 'complete':
        if (test.status !== 'running') throw Errors.badRequest('Can only complete running tests');
        result = await abTestService.completeTest(params.testId, user.sub);
        break;
      case 'cancel':
        if (['completed', 'cancelled'].includes(test.status)) throw Errors.badRequest('Test already finished');
        await abTestService.cancelTest(params.testId, user.sub);
        result = { status: 'cancelled' };
        break;
      default:
        throw Errors.badRequest('Action must be start, complete, or cancel');
    }

    const updated = await prisma.abTest.findUniqueOrThrow({
      where: { id: params.testId },
      include: { variants: true },
    });

    return NextResponse.json({ data: { ...updated, result } });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/v1/ab-tests/:testId - Delete a test
export async function DELETE(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
  try {
    const user = getAuthUser(request);

    const test = await prisma.abTest.findFirst({
      where: { id: params.testId, userId: user.sub },
    });
    if (!test) throw Errors.notFound('A/B Test');

    await prisma.abTest.delete({ where: { id: params.testId } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
