import { AuthorCredit } from "@/components/AuthorCredit"
import { PostOwnerActions } from "@/components/PostOwnerActions"
import { CoverMedia } from "@/components/CoverMedia"
import { MarkdownNote } from "@/components/MarkdownNote"
import { PostEmbeds } from "@/components/PostEmbeds"
import { PostGraph } from "@/components/PostGraph"
import { ShaderCover } from "@/components/ShaderCover"
import { SharePost } from "@/components/SharePost"
import { resolveCatalog } from "@/catalog"
import { shippedCatalogs } from "@/lib/catalogs"
import { treeTypeLabel } from "@/lib/ingest"
import { BRAND_NAME } from "@/lib/brand"
import { markdownPlain } from "@/lib/markdownText"
import { getRequestSession } from "@/lib/auth"
import { getPublicPost, getStoredPost } from "@/lib/store"
import { cn, page, docShell } from "@/lib/ui"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublicPost(slug)
  if (!post) return { title: "Not found" }
  const title = `${post.title} · ${BRAND_NAME}`
  const image = post.card_url ?? `/p/${post.slug}/opengraph-image`
  const description = post.description ? markdownPlain(post.description) || undefined : undefined
  return {
    title,
    description,
    openGraph: {
      title: post.title,
      description,
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
  const [session, stored] = await Promise.all([getRequestSession(), getStoredPost(slug)])
  const canManage = Boolean(session?.user?.id && stored?.user_id && session.user.id === stored.user_id)

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
              by <AuthorCredit name={post.author_name} slug={post.author_slug} />
              {" · "}
              {treeTypeLabel(post.tree_type)} · Blender {post.blender_version_string}
            </p>
            {post.description ? <MarkdownNote className="note-markdown mt-5 max-w-[60ch]" source={post.description} /> : null}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <SharePost slug={post.slug} />
              {canManage ? <PostOwnerActions post={post} /> : null}
            </div>
            <p className="mt-8 border-t border-line pt-5 text-[14px] text-muted">
              No graph is attached to this post yet, so there is nothing to copy.
            </p>
          </header>
          <div className="flex flex-col gap-6">
            {post.cover_video && post.cover_url ? (
              <CoverMedia url={post.cover_url} video className="block w-full rounded-lg ring-1 ring-line" />
            ) : post.cover_shader ? (
              <ShaderCover
                source={post.cover_shader}
                poster={post.cover_url}
                className="aspect-video shrink-0 rounded-lg ring-1 ring-line"
              />
            ) : post.cover_url ? (
              <CoverMedia url={post.cover_url} className="block w-full rounded-lg ring-1 ring-line" />
            ) : null}
            <PostEmbeds youtubeUrl={post.youtube_url} tweetUrl={post.tweet_url} title={post.title} />
          </div>
        </div>
      </div>
    )
  }

  return <PostGraph post={post} payload={post.tree} catalog={resolution.catalog} notice={resolution.notice} canManage={canManage} />
}
