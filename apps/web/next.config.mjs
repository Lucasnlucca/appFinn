/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_EXPORT === 'true' ? 'export' : undefined,
  reactStrictMode: true,
  transpilePackages: ['@finn-ai/shared', '@finn-ai/ui'],
  images: {
    unoptimized: true,
  },
  async rewrites() {
    if (process.env.NEXT_EXPORT === 'true') return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.INTERNAL_API_URL || 'http://localhost:4000'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

