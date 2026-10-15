import { CoverGrid } from "@/components/CoverGrid"
import { postsFiltered } from "@/lib/posts"
import Link from "next/link"

const FILTERS = [
  { id: "", label: "All" },
  { id: "ShaderNodeTree", label: "Shader" },
  { id: "GeometryNodeTree", label: "Geometry" },
  { id: "CompositorNodeTree", label: "Compositor" },
] as const

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tree?: string }>
}) {
  const { tree = "" } = await searchParams
  const list = postsFiltered(tree || null)

  return (
    <div className="app page">
      <div className="gallery">
        <header className="gallery-head">
          <h1>Graphs</h1>
          <p>Open a post, copy the JSON, paste it in Blender. Local paste still lives at Paste.</p>
          <div className="filters">
            {FILTERS.map((f) => (
              <Link key={f.id} className={tree === f.id ? "on" : ""} href={f.id ? `/?tree=${f.id}` : "/"}>
                {f.label}
              </Link>
            ))}
          </div>
        </header>
        <CoverGrid posts={list} />
        {list.length === 0 ? <p className="empty-copy">No posts in this filter.</p> : null}
      </div>
    </div>
  )
}
