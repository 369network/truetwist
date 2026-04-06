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

export default nextConfig;
