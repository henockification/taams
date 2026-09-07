const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Required for a monorepo so standalone output can include
  // files and shared packages outside apps/api.
  outputFileTracingRoot: path.join(__dirname, '../..'),

  async rewrites() {
    return [
      {
        source: '/iclock/cdata',
        destination: '/api/zkteco/cdata',
      },
      {
        source: '/iclock/getrequest',
        destination: '/api/zkteco/getrequest',
      },
    ];
  },

  productionBrowserSourceMaps: false,

  experimental: {
    serverSourceMaps: false,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },

  transpilePackages: ['@taams/shared'],

  // Keep postgres available as a runtime Node.js dependency.
  serverExternalPackages: ['postgres', 'oracledb'],

  webpack: (config, { dev }) => {
    if (!dev) {
      config.devtool = false;
    }

    config.resolve = config.resolve || {};

    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.js', '.ts', '.tsx'],
      '.jsx': ['.jsx', '.tsx'],
    };

    return config;
  },
};

module.exports = nextConfig;
