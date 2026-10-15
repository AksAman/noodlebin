import type { NextConfig } from "next"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const appDir = dirname(fileURLToPath(import.meta.url))
const repo = resolve(appDir, "../..")

const nextConfig: NextConfig = {
  transpilePackages: ["@nodevault/node-view", "@nodevault/catalog", "@nodevault/interchange"],
  turbopack: {
    resolveAlias: {
      "@/fixtures": resolve(repo, "fixtures"),
      "@/catalog-data": resolve(repo, "catalog"),
      "@/node-view/styles.css": resolve(repo, "packages/node-view/src/styles.css"),
      "@/node-view": resolve(repo, "packages/node-view/src/index.ts"),
      "@/catalog/load": resolve(repo, "packages/catalog/src/load.ts"),
      "@/catalog": resolve(repo, "packages/catalog/src/index.ts"),
      "@/interchange": resolve(repo, "packages/interchange/src/index.ts"),
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@/fixtures": resolve(repo, "fixtures"),
      "@/catalog-data": resolve(repo, "catalog"),
      "@/node-view/styles.css": resolve(repo, "packages/node-view/src/styles.css"),
      "@/node-view": resolve(repo, "packages/node-view/src/index.ts"),
      "@/catalog/load": resolve(repo, "packages/catalog/src/load.ts"),
      "@/catalog": resolve(repo, "packages/catalog/src/index.ts"),
      "@/interchange": resolve(repo, "packages/interchange/src/index.ts"),
    }
    return config
  },
}

export default nextConfig
