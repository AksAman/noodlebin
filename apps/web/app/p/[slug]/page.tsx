import { PostGraph } from "@/components/PostGraph"
import { resolveCatalog } from "@/catalog"
import { shippedCatalogs } from "@/lib/catalogs"
import { treeTypeLabel } from "@/lib/ingest"
import { getPublicPost } from "@/lib/store"
import { cn, gallery, shell } from "@/lib/ui"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublicPost(slug)
  if (!post) return { title: "Not found" }
  const title = `${post.title} · NodeVault`
  const image = post.card_url ?? `/p/${post.slug}/opengraph-image`
  return {
    title,
    description: post.description ?? undefined,
    openGraph: {
      title: post.title,
      description: post.description ?? undefined,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      images: [image],
    },
  }
}

export default async function PostRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPublicPost(slug)
  if (!post) notFound()

  const resolution = post.tree ? resolveCatalog(shippedCatalogs, post.tree.blender_version) : null

  if (!post.tree || !resolution) {
    return (
      <div className={cn(shell, "h-auto min-h-full")}>
        <div className={gallery}>
          <header>
            <h1 className="mb-2 text-2xl text-[#eee]">{post.title}</h1>
            <p className="mb-4 max-w-xl leading-snug">
              <Link href={`/@${post.author_slug}`}>@{post.author_slug}</Link>
              {" · "}
              {treeTypeLabel(post.tree_type)} · {post.blender_version_string}
            </p>
            {post.description ? <p className="mb-4 max-w-xl leading-snug">{post.description}</p> : null}
            <p className="pt-6 text-left text-xl leading-snug">The graph appears when a payload is attached.</p>
          </header>
        </div>
      </div>
    )
  }

  return <PostGraph post={post} payload={post.tree} catalog={resolution.catalog} notice={resolution.notice} />
}
