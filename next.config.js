/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.openfoodfacts.org',
      },
      {
        protocol: 'https',
        hostname: 'static.openfoodfacts.org',
      },
    ],
  },
  // Required for zxing-wasm to bundle correctly
  experimental: {
    serverComponentsExternalPackages: ['@zxing/browser'],
  },
}

module.exports = nextConfig
