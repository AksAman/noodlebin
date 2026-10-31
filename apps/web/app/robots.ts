import { siteOrigin } from "@/lib/site"
import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin()
  return {
    rules: {
      userAgent: "*",
      // Covers and social cards can be served from /api/media, so crawlers must reach it.
      allow: ["/", "/api/media/"],
      // /embed duplicates /p, and the rest are private or non-content routes.
      disallow: ["/api/", "/embed/", "/account", "/new", "/sign-in"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}
