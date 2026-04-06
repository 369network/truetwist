/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Reduce serverless function size by externalizing heavy server-only packages
  serverExternalPackages: [
    'ioredis',
    'bullmq',
    'bcryptjs',
    'jsonwebtoken',
    'prisma',
    '@prisma/client',
  ],
  // Increase max function size limit
  experimental: {
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
