import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@roofreply/brand", "@roofreply/social-agent"],
  turbopack: {
    root: repoRoot,
  },
  images: {
    unoptimized: true,
  },

  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, follow" }]
    return process.env.ROOFREPLY_INDEXING_ENABLED !== "true"
      ? [{ source: "/:path*", headers: noindex }]
      : [{ source: "/:path*", missing: [{ type: "host", value: "www\\.roofreply\\.com" }], headers: noindex }]
  },

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ]
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
}

export default nextConfig
