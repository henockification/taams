import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async rewrites() {
    return [
      {
        source: '/iclock/cdata',
        destination: '/api/zkteco/cdata',
      },
      {
        source: '/iclock/getrequest',
        destination: '/api/zkteco/getrequest'
      }
    ];
  },
  // Disable source maps completely to avoid the source-map issue
  productionBrowserSourceMaps: false,
  // Disable server source maps as well
  experimental: {
    serverSourceMaps: false,
  },
  // Ensure proper dependency resolution
  transpilePackages: ['@taams/shared'],
  // External packages that should not be bundled (Next.js 15+ renamed from serverComponentsExternalPackages)
  serverExternalPackages: ['postgres'],
  // Add empty turbopack config to silence Next.js 16 warning
  // We're using webpack config below, so we explicitly set turbopack to empty
  turbopack: {},
  // Disable webpack source maps and ensure proper module resolution
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      config.devtool = false;
    }
    
    // Ensure drizzle-orm is properly resolved
    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.jsx': ['.jsx', '.tsx'],
    };
    
    // For server builds, ensure proper module resolution in monorepo
    if (isServer) {
      // Don't externalize drizzle-orm - it needs to be available
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals = config.externals.filter(
          (ext) => typeof ext !== 'string' || ext !== 'drizzle-orm'
        );
      }
      
      // Ensure proper module resolution
      config.resolve.modules = [
        'node_modules',
        ...(config.resolve.modules || []),
      ];
    }
    
    return config;
  },
}

export default nextConfig
