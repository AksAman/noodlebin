import { HOMEPAGE_NOISE_SLUG } from "@/lib/posts"
import { siteOrigin } from "@/lib/site"
import { allPublicPosts } from "@/lib/store"
import type { MetadataRoute } from "next"

// Posts live in a database that is not reachable at build time.
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin()
  const posts = (await allPublicPosts()).filter((post) => post.slug !== HOMEPAGE_NOISE_SLUG)

  const latestByAuthor = new Map<string, Date>()
  const entries: MetadataRoute.Sitemap = []

  for (const post of posts) {
    const lastModified = new Date(post.created_at)
    const valid = !Number.isNaN(lastModified.getTime())
    entries.push({
      url: `${origin}/p/${post.slug}`,
      ...(valid ? { lastModified } : {}),
      changeFrequency: "monthly",
      priority: 0.7,
    })
    if (post.author_slug && valid) {
      const prev = latestByAuthor.get(post.author_slug)
      if (!prev || lastModified > prev) latestByAuthor.set(post.author_slug, lastModified)
    } else if (post.author_slug && !latestByAuthor.has(post.author_slug)) {
      latestByAuthor.set(post.author_slug, new Date(0))
    }
  }

  const authors: MetadataRoute.Sitemap = [...latestByAuthor].map(([slug, lastModified]) => ({
    url: `${origin}/@${slug}`,
    ...(lastModified.getTime() > 0 ? { lastModified } : {}),
    changeFrequency: "weekly",
    priority: 0.5,
  }))

  return [
    { url: origin, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/paste`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/addon`, changeFrequency: "monthly", priority: 0.6 },
    ...entries,
    ...authors,
  ]
}
