import { treeTypeLabel } from "@/lib/ingest"
import { dataDir, getPublicPost, readMediaFile } from "@/lib/store"
import { ImageResponse } from "next/og"

export const runtime = "nodejs"
export const alt = "NodeVault"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPublicPost(slug, dataDir())
  if (!post) {
    return new Response("Not found", { status: 404 })
  }

  let coverSrc: string | null = null
  if (!post.seeded && !post.cover_video) {
    const cover = await readMediaFile(slug, "cover", dataDir())
    if (cover?.type.startsWith("image/")) coverSrc = `data:${cover.type};base64,${cover.bytes.toString("base64")}`
  }

  const typeLabel = treeTypeLabel(post.tree_type)
  const fallback =
    post.tree_type === "GeometryNodeTree"
      ? "linear-gradient(135deg, #204a38, #141e1a)"
      : post.tree_type === "CompositorNodeTree"
        ? "linear-gradient(135deg, #20304a, #14181e)"
        : "linear-gradient(135deg, #4a3820, #1e1a14)"

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#171717",
          color: "#eee",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            height: 500,
            background: fallback,
          }}
        >
          {coverSrc ? (
            <img src={coverSrc} alt="" width={1200} height={500} style={{ objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", width: "100%", height: "100%" }} />
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            height: 130,
            paddingLeft: 40,
            paddingRight: 40,
            background: "#111",
          }}
        >
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700 }}>{post.title}</div>
          <div style={{ display: "flex", fontSize: 22, color: "#bbb", marginTop: 8 }}>
            {`${post.author_slug ? `@${post.author_slug}` : post.author_name} · ${typeLabel} · NodeVault`}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
