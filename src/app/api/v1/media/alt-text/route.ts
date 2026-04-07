export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse } from "@/lib/errors";

/**
 * GET /api/v1/media/alt-text — list media with missing or existing alt text.
 * Query params: filter=missing|all (default: all), page, pageSize
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") ?? "all";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 50)));

    const where = {
      post: { userId: user.sub },
      mediaType: "image",
      ...(filter === "missing" ? { OR: [{ altText: null }, { altText: "" }] } : {}),
    };

    const [media, total] = await Promise.all([
      prisma.postMedia.findMany({
        where,
        select: {
          id: true,
          mediaUrl: true,
          thumbnailUrl: true,
          altText: true,
          width: true,
          height: true,
          sortOrder: true,
          post: { select: { id: true, contentText: true } },
        },
        orderBy: { post: { createdAt: "desc" } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.postMedia.count({ where }),
    ]);

    return NextResponse.json({
      data: media,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/v1/media/alt-text — bulk update alt text.
 * Body: { updates: [{ id: string, altText: string }] }
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = getAuthUser(req);

    const body = await req.json();
    const updates: { id: string; altText: string }[] = body.updates;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "updates array required" }, { status: 400 });
    }

    if (updates.length > 100) {
      return NextResponse.json({ error: "Max 100 updates per request" }, { status: 400 });
    }

    // Verify all media belongs to the user
    const mediaIds = updates.map((u) => u.id);
    const owned = await prisma.postMedia.count({
      where: {
        id: { in: mediaIds },
        post: { userId: user.sub },
      },
    });

    if (owned !== mediaIds.length) {
      return NextResponse.json({ error: "Some media not found or not owned" }, { status: 403 });
    }

    // Bulk update via transaction
    const results = await prisma.$transaction(
      updates.map((u) =>
        prisma.postMedia.update({
          where: { id: u.id },
          data: { altText: u.altText },
          select: { id: true, altText: true },
        })
      )
    );

    return NextResponse.json({ updated: results.length, data: results });
  } catch (error) {
    return errorResponse(error);
  }
}
