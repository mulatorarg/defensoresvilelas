/** @type {import('next').NextConfig} */
const backendPort = process.env.PORT || 3001;
const backendUrl = `http://localhost:${backendPort}`;

const nextConfig = {
  output: 'export',
  distDir: 'dist',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || backendUrl,
  },
};

module.exports = nextConfig;
