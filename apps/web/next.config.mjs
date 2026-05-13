/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@aitek/ui', '@aitek/types', '@aitek/config', '@aitek/workflows'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
  },
}

export default nextConfig
