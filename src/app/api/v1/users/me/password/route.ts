export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { verifyPassword, hashPassword } from '@/lib/auth';
import { changePasswordSchema } from '@/lib/validations';
import { errorResponse, Errors } from '@/lib/errors';

export async function PUT(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    const body = await request.json();
    const result = changePasswordSchema.safeParse(body);

    if (!result.success) {
      throw Errors.validation(result.error.flatten().fieldErrors);
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { hashedPassword: true },
    });

    if (!user?.hashedPassword) {
      throw Errors.badRequest('Cannot change password for OAuth accounts');
    }

    const isValid = await verifyPassword(result.data.currentPassword, user.hashedPassword);
    if (!isValid) {
      throw Errors.unauthorized('Current password is incorrect');
    }

    const hashedPassword = await hashPassword(result.data.newPassword);
    await prisma.user.update({
      where: { id: auth.sub },
      data: { hashedPassword },
    });

    return NextResponse.json({
      data: { message: 'Password changed successfully.' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
