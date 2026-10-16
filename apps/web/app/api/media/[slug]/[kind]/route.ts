import { isSafeSlug, isVercelBlobUrl } from "@/lib/media"
import { dataDir, getStoredPost, readMediaFile } from "@/lib/store"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; kind: string }> },
) {
  const { slug, kind } = await params
  if (!isSafeSlug(slug) || (kind !== "cover" && kind !== "video" && kind !== "blend")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }
  const post = await getStoredPost(slug, dataDir())
  const stored = kind === "cover" ? post?.cover_file : kind === "video" ? post?.video_file : post?.blend_file
  if (stored && isVercelBlobUrl(stored)) {
    return NextResponse.redirect(stored, 302)
  }
  const file = await readMediaFile(slug, kind, dataDir())
  if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 })
  const headers = new Headers()
  headers.set("content-type", file.type)
  headers.set("cache-control", "public, max-age=31536000, immutable")
  if (kind === "blend") {
    headers.set("content-disposition", `attachment; filename="${file.filename.replaceAll('"', "")}"`)
  }
  return new NextResponse(Uint8Array.from(file.bytes), { headers })
}
