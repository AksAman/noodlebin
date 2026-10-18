import { createUpload } from "@/lib/azureBlob"
import { parseUploadKind } from "@/lib/blobUpload"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const kind = parseUploadKind((await params).kind)
  if (!kind) return NextResponse.json({ error: "Unknown upload." }, { status: 404 })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }
  const record = typeof body === "object" && body !== null ? body : {}
  const contentType = "contentType" in record ? String(record.contentType) : ""
  const byteSize = "byteSize" in record ? Number(record.byteSize) : Number.NaN
  const created = await createUpload(kind, contentType, byteSize)
  if ("error" in created) return NextResponse.json({ error: created.error }, { status: created.status })
  return NextResponse.json(created)
}
