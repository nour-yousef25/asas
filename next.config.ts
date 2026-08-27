import type { NextConfig } from "next";

const atomicDistDir = process.env.ASAS_NEXT_DIST_DIR;
if (atomicDistDir && (!atomicDistDir.startsWith(".build-tmp/") || atomicDistDir.includes(".."))) {
  throw new Error("ASAS_NEXT_DIST_DIR must remain inside .build-tmp");
}

const nextConfig: NextConfig = {
  distDir: atomicDistDir ?? ".next",
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
