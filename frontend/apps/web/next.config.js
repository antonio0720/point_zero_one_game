const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@pzo/engine'],
  webpack: (config, { isServer }) => {
    // Force all module resolution through this app's node_modules
    // (fixes symlinked @pzo/engine resolving deps from wrong level)
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      'node_modules',
    ];

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        'node:crypto': false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
