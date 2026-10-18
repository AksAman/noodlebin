import type { NextConfig } from "next"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const appDir = dirname(fileURLToPath(import.meta.url))
const repo = resolve(appDir, "../..")

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "pg", "@azure/storage-blob"],
  transpilePackages: ["@nodevault/node-view", "@nodevault/catalog", "@nodevault/interchange"],
  turbopack: {
    root: repo,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@/fixtures": resolve(repo, "fixtures"),
      "@/catalog-data": resolve(repo, "catalog"),
      "@/node-view/styles.css": resolve(repo, "packages/node-view/src/styles.css"),
      "@/node-view/layout": resolve(repo, "packages/node-view/src/layout.ts"),
      "@/node-view/color": resolve(repo, "packages/node-view/src/color.ts"),
      "@/node-view": resolve(repo, "packages/node-view/src/index.ts"),
      "@/catalog/load": resolve(repo, "packages/catalog/src/load.ts"),
      "@/catalog": resolve(repo, "packages/catalog/src/index.ts"),
      "@/interchange": resolve(repo, "packages/interchange/src/index.ts"),
    }
    return config
  },
  // PostHog capture uses trailing slashes (/e/). A redirect would drop the body.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/api/v1/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/api/v1/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/embed/:slug",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ]
  },
}

export default nextConfig
