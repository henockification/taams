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

  transpilePackages: ['@taams/shared'],

  // Keep postgres available as a runtime Node.js dependency.
  serverExternalPackages: ['postgres'],

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