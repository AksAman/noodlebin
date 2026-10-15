import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: [resolve(root, "../..")] },
  },
  resolve: {
    alias: {
      "@nodevault/node-view": resolve(root, "../../packages/node-view/src/index.ts"),
      "@nodevault/node-view/styles.css": resolve(root, "../../packages/node-view/src/styles.css"),
      "@nodevault/catalog": resolve(root, "../../packages/catalog/src/index.ts"),
      "@nodevault/catalog/load": resolve(root, "../../packages/catalog/src/load.ts"),
      "@nodevault/interchange": resolve(root, "../../packages/interchange/src/index.ts"),
    },
  },
})
