import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Reduce serverless function size by externalizing heavy server-only packages
    serverComponentsExternalPackages: [
      'ioredis',
      'bullmq',
      'bcryptjs',
      'jsonwebtoken',
      'prisma',
      '@prisma/client',
    ],
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl',
        'node_modules/@esbuild/linux-x64',
      ],
    },
  },
};

export default withSentryConfig(nextConfig, {
  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps in CI with auth token present
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
  // Hides source maps from generated client bundles
  hideSourceMaps: true,
});
