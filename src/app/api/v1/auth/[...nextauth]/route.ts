export const dynamic = "force-dynamic";
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Apple from 'next-auth/providers/apple';
import { prisma } from '@/lib/prisma';
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry, hashToken } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';
import type { PlanTier } from '@/types';

const { handlers } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    Apple({
      clientId: process.env.APPLE_ID || '',
      clientSecret: process.env.APPLE_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user.email) return false;

      const provider = account.provider; // 'google' or 'apple'

      // Find or create user
      let dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            email: user.email,
            name: user.name || user.email.split('@')[0],
            provider,
            avatarUrl: user.image || null,
            emailVerified: new Date(),
          },
        });

        // Send welcome email (non-blocking)
        if (process.env.RESEND_API_KEY) {
          sendWelcomeEmail(dbUser.email, dbUser.name).catch(console.error);
        }
      } else if (!dbUser.emailVerified) {
        // OAuth verifies email, so mark it verified
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { emailVerified: new Date() },
        });
      }

      return true;
    },

    async jwt({ token, account, user }) {
      if (account && user?.email) {
        // First sign-in: look up db user and generate our JWT tokens
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.plan = dbUser.plan;
          token.accessToken = generateAccessToken(
            dbUser.id,
            dbUser.email,
            dbUser.plan as PlanTier
          );

          // Create refresh token in DB
          const refresh = generateRefreshToken(dbUser.id);
          await prisma.refreshToken.create({
            data: {
              userId: dbUser.id,
              tokenHash: hashToken(refresh.token),
              expiresAt: getRefreshTokenExpiry(),
            },
          });
          token.refreshToken = refresh.token;
          token.provider = account.provider;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        (session as unknown as Record<string, unknown>).accessToken = token.accessToken;
        (session as unknown as Record<string, unknown>).refreshToken = token.refreshToken;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
});

export const { GET, POST } = handlers;
