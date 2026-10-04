/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    localPatterns: [
      {
        pathname: '/uploads/**',
      },
    ],
  },
  serverExternalPackages: ['mongoose'],
}

module.exports = nextConfig
