import { dataDir, readMediaFile } from "@/lib/store"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; kind: string }> },
) {
  const { slug, kind } = await params
  if (kind !== "cover" && kind !== "video" && kind !== "blend") {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }
  const file = await readMediaFile(slug, kind, dataDir())
  if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 })
  const headers = new Headers()
  headers.set("content-type", file.type)
  if (kind === "blend") {
    headers.set("content-disposition", `attachment; filename="${file.filename.replaceAll('"', "")}"`)
  }
  return new NextResponse(Uint8Array.from(file.bytes), { headers })
}
