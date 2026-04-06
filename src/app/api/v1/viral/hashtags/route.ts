import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse } from '@/lib/errors';
import { getHashtagRecommendations, getRelatedHashtags } from '@/lib/viral';
import { hashtagRecommendationSchema } from '@/lib/viral/validations';

// POST /api/v1/viral/hashtags - Get hashtag recommendations for a topic
export async function POST(request: NextRequest) {
  try {
    getAuthUser(request);

    const body = await request.json();
    const parsed = hashtagRecommendationSchema.parse(body);

    const result = await getHashtagRecommendations(parsed.topic, parsed.platform, parsed.limit);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /api/v1/viral/hashtags?tag=fitness&platform=instagram - Get related hashtags
export async function GET(request: NextRequest) {
  try {
    getAuthUser(request);

    const tag = request.nextUrl.searchParams.get('tag');
    const platform = request.nextUrl.searchParams.get('platform');

    if (!tag || !platform) {
      return NextResponse.json(
        { error: { error: 'tag and platform are required', code: 'BAD_REQUEST' } },
        { status: 400 }
      );
    }

    const related = await getRelatedHashtags(tag, platform);
    return NextResponse.json({ data: related });
  } catch (error) {
    return errorResponse(error);
  }
}
