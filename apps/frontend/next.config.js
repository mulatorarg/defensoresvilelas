/** @type {import('next').NextConfig} */
const { execSync } = require('child_process');

const backendPort = process.env.PORT || 3001;
const backendUrl = `http://localhost:${backendPort}`;

function resolveBuildSha() {
  if (process.env.NEXT_PUBLIC_BUILD_SHA) {
    return process.env.NEXT_PUBLIC_BUILD_SHA.slice(0, 7);
  }
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

const nextConfig = {
  output: 'export',
  distDir: 'dist',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  env: {
    // '' = URLs relativas (producción: la API sirve la web en la misma origin).
    // undefined = dev sin config -> fallback al backend local.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? backendUrl,
    NEXT_PUBLIC_BUILD_SHA: resolveBuildSha(),
  },
};

module.exports = nextConfig;
