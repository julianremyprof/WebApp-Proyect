import type { NextConfig } from "next";

// Cloudflare Workers (via OpenNext) needs a standard Next.js build.
// No `output: "export"` and no Vercel-only features (next/image with the
// default loader is fine; Node-only APIs in the runtime are not).
const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Cloudflare Workers cannot run the default Next.js image optimizer.
    // Use unoptimized images (served as-is) or swap in a Cloudflare Images
    // loader later (see docs/CLOUDFLARE_DEPLOY.md, section "Images").
    unoptimized: true,
  },
  experimental: {
    // Keep server bundles small for the Workers Free plan (script size limit).
    optimizePackageImports: ["recharts"],
  },
};

export default nextConfig;

// Enables `getCloudflareContext()` (bindings like KV/R2/env secrets) while
// running the normal `next dev` server, so local dev behaves like the
// deployed Worker without needing `wrangler dev` for everyday development.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
