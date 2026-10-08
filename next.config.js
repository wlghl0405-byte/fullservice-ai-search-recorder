/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'playwright',
        'playwright-core',
      ].filter(Boolean);
    }
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/data/saved/**'],
    };
    return config;
  },
};

module.exports = nextConfig;
