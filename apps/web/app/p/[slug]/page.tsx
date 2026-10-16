import { PostEmbeds } from "@/components/PostEmbeds"
import { PostGraph } from "@/components/PostGraph"
import { ShaderCover } from "@/components/ShaderCover"
import { resolveCatalog } from "@/catalog"
import { shippedCatalogs } from "@/lib/catalogs"
import { treeTypeLabel } from "@/lib/ingest"
import { getPublicPost } from "@/lib/store"
import { cn, page, docShell } from "@/lib/ui"
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
      <div className={docShell}>
        <div className={cn(page, "grid gap-10 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]")}>
          <header>
            <h1 className="m-0 font-display text-[clamp(2rem,1.4rem+2.4vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-fg">
              {post.title}
            </h1>
            <p className="mt-3 text-[14px] text-muted">
              by{" "}
              <Link className="text-fg underline-offset-4 hover:underline" href={`/@${post.author_slug}`}>
                {post.author_name}
              </Link>
              {" · "}
              {treeTypeLabel(post.tree_type)} · Blender {post.blender_version_string}
            </p>
            {post.description ? <p className="mt-5 max-w-[60ch] leading-relaxed text-muted">{post.description}</p> : null}
            <p className="mt-8 border-t border-line pt-5 text-[14px] text-muted">
              No graph is attached to this post yet, so there is nothing to copy.
            </p>
          </header>
          <div className="flex flex-col gap-6">
            {post.cover_shader ? (
              <ShaderCover
                source={post.cover_shader}
                poster={post.cover_url}
                className={cn("rounded-lg ring-1 ring-line", !post.cover_url && "aspect-[4/3]")}
              />
            ) : post.cover_url ? (
              <img className="block w-full rounded-lg ring-1 ring-line" src={post.cover_url} alt="" />
            ) : null}
            <PostEmbeds youtubeUrl={post.youtube_url} tweetUrl={post.tweet_url} title={post.title} />
          </div>
        </div>
      </div>
    )
  }

  return <PostGraph post={post} payload={post.tree} catalog={resolution.catalog} notice={resolution.notice} />
}
