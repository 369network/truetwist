export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';
import { postLifecycle } from '@/lib/scheduling';
import { PlatformSchema } from '@/lib/social/types';
import { z } from 'zod';

const bulkScheduleSchema = z.object({
  timezone: z.string().default('UTC'),
  items: z.array(z.object({
    postId: z.string().uuid(),
    platforms: z.array(z.object({
      socialAccountId: z.string().uuid(),
      platform: PlatformSchema,
      scheduledAt: z.string().datetime(),
    })).min(1),
  })).min(1).max(50, 'Maximum 50 posts per bulk schedule'),
});

// POST /api/v1/schedules/bulk - Schedule multiple posts at once
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = bulkScheduleSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { timezone, items } = result.data;

    // Verify ownership of all posts
    const postIds = items.map((i) => i.postId);
    const posts = await prisma.post.findMany({
      where: { id: { in: postIds }, userId: user.sub },
    });
    if (posts.length !== postIds.length) {
      throw Errors.badRequest('One or more posts not found');
    }

    // Verify all social accounts
    const allAccountIds = Array.from(
      new Set(items.flatMap((i) => i.platforms.map((p) => p.socialAccountId)))
    );
    const accounts = await prisma.socialAccount.findMany({
      where: { id: { in: allAccountIds }, userId: user.sub, isActive: true },
    });
    if (accounts.length !== allAccountIds.length) {
      throw Errors.badRequest('One or more social accounts not found or inactive');
    }

    // Schedule each post, collecting results and errors
    const results: Array<{ postId: string; success: boolean; data?: unknown; error?: string }> = [];

    for (const item of items) {
      try {
        const post = posts.find((p) => p.id === item.postId);
        if (post && !['draft', 'failed'].includes(post.status)) {
          results.push({
            postId: item.postId,
            success: false,
            error: `Post is in "${post.status}" status and cannot be scheduled`,
          });
          continue;
        }

        const scheduled = await postLifecycle.schedulePost({
          postId: item.postId,
          userId: user.sub,
          platforms: item.platforms.map((p) => ({
            ...p,
            scheduledAt: new Date(p.scheduledAt),
          })),
          timezone,
        });

        results.push({ postId: item.postId, success: true, data: scheduled });
      } catch (error) {
        results.push({
          postId: item.postId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      data: results,
      summary: { total: items.length, success: successCount, failed: failCount },
    }, { status: failCount === items.length ? 422 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
