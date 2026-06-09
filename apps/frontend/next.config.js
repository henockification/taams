const withNextIntl = require('next-intl/plugin')(
  // Relative path required for Turbopack support
  './src/i18n/request.ts'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@taams/shared'],
  // Remove absolute path for Vercel compatibility
  // outputFileTracingRoot will be auto-detected in monorepo
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'files.taams.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pub-7b37cc0ad9384817b58ad75dd236e1f8.r2.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Explicitly configure webpack to ensure it's used instead of Turbopack
  webpack: (config, { isServer }) => {
    // Return config to ensure webpack is used
    return config;
  },
}

module.exports = withNextIntl(nextConfig)
