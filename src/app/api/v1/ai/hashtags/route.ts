export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { PlatformSchema } from '@/lib/social/types';
import { generateHashtags } from '@/lib/ai/text-generation-service';

const hashtagSchema = z.object({
  topic: z.string().min(1).max(500),
  platform: PlatformSchema,
  count: z.number().int().min(1).max(30).optional(),
});

// POST /api/v1/ai/hashtags - Generate hashtags for a topic
export async function POST(request: NextRequest) {
  try {
    getAuthUser(request); // ensure authenticated
    const body = await request.json();
    const result = hashtagSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { topic, platform, count } = result.data;
    const hashtags = await generateHashtags(topic, platform, count);

    return NextResponse.json({ data: { hashtags } });
  } catch (error) {
    return errorResponse(error);
  }
}
