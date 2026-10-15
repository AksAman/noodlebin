import { parseNodeVaultText } from "@/interchange"
import { treeTypeLabel } from "@/lib/ingest"
import { filterPosts } from "@/lib/posts"
import { isSharingError, parseCreateForm } from "@/lib/sharing"
import { allPublicPosts, createStoredPost, dataDir } from "@/lib/store"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const author = url.searchParams.get("author")
  const tree_type = url.searchParams.get("tree_type")
  const list = filterPosts(await allPublicPosts(dataDir()), { author, tree_type })
  return NextResponse.json({
    posts: list.map((post) => ({
      ...post,
      tree_type_label: treeTypeLabel(post.tree_type),
    })),
  })
}

export async function POST(request: Request) {
  const form = await request.formData()
  const parsed = await parseCreateForm(form, parseNodeVaultText)
  if (isSharingError(parsed)) return fail(parsed.status, parsed.error)
  const created = await createStoredPost(parsed, dataDir())
  return NextResponse.json(
    { url: created.url, edit_token: created.edit_token, post: created.post },
    { status: 201 },
  )
}
