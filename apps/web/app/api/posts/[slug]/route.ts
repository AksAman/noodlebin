import { parseNodeVaultText } from "@/interchange"
import { treeTypeLabel } from "@/lib/ingest"
import { requireDurableStore } from "@/lib/publish"
import {
  editTokenFromRequest,
  isSharingError,
  parseLinkFields,
  readBlend,
  readCover,
  readPayload,
  readVideo,
} from "@/lib/sharing"
import { dataDir, getPublicPost, patchStoredPost } from "@/lib/store"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPublicPost(slug, dataDir())
  if (!post) return fail(404, "Post not found.")
  return NextResponse.json({ post: { ...post, tree_type_label: treeTypeLabel(post.tree_type) } })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const form = await request.formData()
  const storage = requireDurableStore()
  if (storage) return fail(storage.status, storage.error)
  const token = editTokenFromRequest(request, form)
  if (!token) return fail(401, "Edit token required.")

  const coverField = form.get("cover")
  const videoField = form.get("video")
  const blendField = form.get("blend")
  const treeField = form.get("tree")
  const treeFile = treeField instanceof File ? treeField : null
  const treeText = treeFile ? "" : String(form.get("tree_text") ?? "")

  const patch: Parameters<typeof patchStoredPost>[2] = {}

  if (coverField instanceof File && coverField.size > 0) {
    const cover = await readCover(coverField)
    if (isSharingError(cover)) return fail(cover.status, cover.error)
    patch.cover = cover
  }
  const video = await readVideo(videoField instanceof File ? videoField : null)
  if (isSharingError(video)) return fail(video.status, video.error)
  if (video) patch.video = video
  const blend = await readBlend(blendField instanceof File ? blendField : null)
  if (isSharingError(blend)) return fail(blend.status, blend.error)
  if (blend) patch.blend = blend
  const tree = await readPayload(treeFile, treeText || null, parseNodeVaultText)
  if (isSharingError(tree)) return fail(tree.status, tree.error)
  if (tree) patch.tree = tree
  const links = parseLinkFields(form)
  if (isSharingError(links)) return fail(links.status, links.error)
  Object.assign(patch, links)

  const result = await patchStoredPost(slug, token, patch, dataDir())
  if (isSharingError(result)) return fail(result.status, result.error)
  return NextResponse.json({ post: result.post })
}
