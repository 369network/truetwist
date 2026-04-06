export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse, Errors } from "@/lib/errors";
import { configureMlsFeed } from "@/lib/integrations/mls-connector";
import { z } from "zod";

const connectSchema = z.object({
  businessId: z.string().uuid("Invalid business ID"),
  feedUrl: z.string().url("Invalid feed URL"),
  credentials: z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    tokenUrl: z.string().url().optional(),
  }),
  syncSchedule: z.string().optional(),
});

// POST /api/v1/integrations/mls/connect — Configure MLS feed connection
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json();
    const result = connectSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const { businessId, feedUrl, credentials, syncSchedule } = result.data;

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: user.sub },
    });
    if (!business) {
      throw Errors.notFound("Business");
    }

    const connection = await configureMlsFeed(
      businessId,
      feedUrl,
      credentials,
      syncSchedule
    );

    return NextResponse.json({ data: connection });
  } catch (error) {
    return errorResponse(error);
  }
}
