import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  redirects: async () => [
    { source: '/map', destination: '/activity', permanent: true },
    { source: '/graph', destination: '/governance', permanent: true },
  ],
};

export default nextConfig;
