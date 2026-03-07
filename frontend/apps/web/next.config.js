/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@pzo/engine'],
  webpack: (config, { isServer }) => {
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
