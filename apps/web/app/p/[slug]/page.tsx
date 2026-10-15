import { PostGraph } from "@/components/PostGraph"
import { resolveCatalog } from "@/catalog"
import { shippedCatalogs } from "@/lib/catalogs"
import { treeTypeLabel } from "@/lib/ingest"
import { postBySlug, posts } from "@/lib/posts"
import Link from "next/link"
import { notFound } from "next/navigation"

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }))
}

export default async function PostRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = postBySlug(slug)
  if (!post) notFound()

  const resolution = resolveCatalog(shippedCatalogs, post.tree.blender_version)

  return (
    <div className="app page">
      <div className={`cover-hero tree-${post.tree_type}`} />
      <div className="post-meta">
        <h1>{post.title}</h1>
        <p>
          <Link href={`/@${post.author_slug}`}>@{post.author_slug}</Link>
          {" · "}
          {treeTypeLabel(post.tree_type)} · {post.blender_version_string}
        </p>
        {post.description ? <p>{post.description}</p> : null}
      </div>
      <PostGraph payload={post.tree} catalog={resolution.catalog} notice={resolution.notice} />
    </div>
  )
}
