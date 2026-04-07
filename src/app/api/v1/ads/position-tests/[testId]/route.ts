export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { AdPositionTestService } from '@/lib/ads/ad-position-test-service';

const positionTestService = new AdPositionTestService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    getAuthUser(request);
    const { testId } = await params;

    const test = await positionTestService.getTest(testId);
    if (!test) throw Errors.notFound('Position test');

    return NextResponse.json({ data: test });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    getAuthUser(request);
    const { testId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'start':
        await positionTestService.startTest(testId);
        break;
      case 'complete':
        await positionTestService.completeTest(testId);
        break;
      case 'cancel':
        await positionTestService.cancelTest(testId);
        break;
      case 'check-significance': {
        const result = await positionTestService.checkSignificance(testId);
        return NextResponse.json({ data: result });
      }
      default:
        throw Errors.badRequest('Invalid action. Use: start, complete, cancel, check-significance');
    }

    const test = await positionTestService.getTest(testId);
    return NextResponse.json({ data: test });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    getAuthUser(request);
    const { testId } = await params;

    await positionTestService.cancelTest(testId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
