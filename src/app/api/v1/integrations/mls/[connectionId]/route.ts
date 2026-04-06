export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/middleware/auth";
import { errorResponse, Errors } from "@/lib/errors";

// DELETE /api/v1/integrations/mls/:connectionId — Disconnect MLS feed
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const user = getAuthUser(request);
    const { connectionId } = await params;

    const connection = await prisma.mlsConnection.findUnique({
      where: { id: connectionId },
      include: { business: true },
    });

    if (!connection) {
      throw Errors.notFound("MLS connection");
    }

    if (connection.business.userId !== user.sub) {
      throw Errors.forbidden("Not authorized to delete this connection");
    }

    await prisma.mlsConnection.delete({
      where: { id: connectionId },
    });

    return NextResponse.json({
      data: { message: "MLS connection removed" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
