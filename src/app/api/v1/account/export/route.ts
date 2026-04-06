export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/middleware/auth';
import { errorResponse, Errors } from '@/lib/errors';

// POST /api/v1/account/export — Request a GDPR data export
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const body = await request.json().catch(() => ({}));
    const format = body.format === 'csv' ? 'csv' : 'json';

    // Throttle: only one pending/processing export at a time
    const existing = await prisma.dataExportRequest.findFirst({
      where: {
        userId: user.sub,
        status: { in: ['pending', 'processing'] },
      },
    });

    if (existing) {
      throw Errors.conflict(
        'A data export is already in progress. Please wait for it to complete.'
      );
    }

    // Gather all user data
    const [
      profile,
      businesses,
      posts,
      socialAccounts,
      aiGenerations,
      apiKeys,
      teams,
      creditBalance,
      creditTransactions,
      webhookEndpoints,
      trendAlertPrefs,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.sub },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          provider: true,
          plan: true,
          onboardingCompleted: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.business.findMany({
        where: { userId: user.sub },
        select: {
          id: true, name: true, industry: true, description: true, website: true,
          brandVoice: true, createdAt: true, updatedAt: true,
          competitors: { select: { id: true, name: true, websiteUrl: true, createdAt: true } },
        },
      }),
      prisma.post.findMany({
        where: { userId: user.sub },
        select: {
          id: true, contentText: true, contentType: true, status: true,
          aiGenerated: true, viralScore: true, createdAt: true, updatedAt: true,
          media: { select: { id: true, mediaType: true, mediaUrl: true, altText: true } },
          schedules: { select: { id: true, platform: true, scheduledAt: true, postedAt: true, status: true } },
          comments: { select: { id: true, content: true, createdAt: true } },
        },
      }),
      prisma.socialAccount.findMany({
        where: { userId: user.sub },
        select: {
          id: true,
          platform: true,
          accountName: true,
          accountHandle: true,
          followerCount: true,
          isActive: true,
          connectedAt: true,
          // Exclude tokens for security
        },
      }),
      prisma.aiGeneration.findMany({
        where: { userId: user.sub },
        select: {
          id: true,
          generationType: true,
          prompt: true,
          modelUsed: true,
          outputText: true,
          outputMediaUrl: true,
          tokensInput: true,
          tokensOutput: true,
          costCents: true,
          createdAt: true,
        },
      }),
      prisma.apiKey.findMany({
        where: { userId: user.sub },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scope: true,
          status: true,
          createdAt: true,
          lastUsedAt: true,
          requestCount: true,
          // Exclude keyHash for security
        },
      }),
      prisma.teamMember.findMany({
        where: { userId: user.sub },
        include: { team: { select: { id: true, name: true } } },
      }),
      prisma.creditBalance.findUnique({
        where: { userId: user.sub },
      }),
      prisma.creditTransaction.findMany({
        where: { userId: user.sub },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      prisma.webhookEndpoint.findMany({
        where: { userId: user.sub },
        select: {
          id: true,
          url: true,
          events: true,
          status: true,
          description: true,
          createdAt: true,
          // Exclude HMAC secret
        },
      }),
      prisma.trendAlertPreference.findMany({
        where: { userId: user.sub },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      format: 'TrueTwist GDPR Data Export',
      user: profile,
      businesses,
      posts,
      socialAccounts,
      aiGenerations,
      apiKeys,
      teams,
      credits: {
        balance: creditBalance,
        recentTransactions: creditTransactions,
      },
      webhookEndpoints,
      trendAlertPreferences: trendAlertPrefs,
    };

    // Record the export request
    const exportRequest = await prisma.dataExportRequest.create({
      data: {
        userId: user.sub,
        status: 'completed',
        format,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Log the export action
    await prisma.auditLog.create({
      data: {
        userId: user.sub,
        action: 'data.export',
        resource: 'user',
        resourceId: user.sub,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
        metadata: { format, exportRequestId: exportRequest.id },
        severity: 'info',
      },
    });

    return NextResponse.json({
      data: {
        exportId: exportRequest.id,
        status: 'completed',
        format,
        expiresAt: exportRequest.expiresAt,
        export: exportData,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /api/v1/account/export — List user's export requests
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);

    const exports = await prisma.dataExportRequest.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        format: true,
        expiresAt: true,
        completedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: exports });
  } catch (error) {
    return errorResponse(error);
  }
}
