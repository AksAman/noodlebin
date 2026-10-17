import { EmbedFrame } from "@/components/EmbedFrame"
import { resolveCatalog } from "@/catalog"
import { shippedCatalogs } from "@/lib/catalogs"
import { getPublicPost } from "@/lib/store"

export const dynamic = "force-dynamic"

export default async function EmbedRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ copy?: string }>
}) {
  const { slug } = await params
  const { copy } = await searchParams
  const post = await getPublicPost(slug)
  if (!post?.tree) {
    return <p className="p-6 text-muted">This graph is not available.</p>
  }
  const resolution = resolveCatalog(shippedCatalogs, post.tree.blender_version)
  return <EmbedFrame post={post} catalog={resolution.catalog} allowCopy={copy === "1"} />
}
