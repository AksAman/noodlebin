import { CoverGrid } from "@/components/CoverGrid"
import { filterPosts } from "@/lib/posts"
import { allPublicPosts } from "@/lib/store"
import { cn, gallery, shell } from "@/lib/ui"
import Link from "next/link"

export const dynamic = "force-dynamic"

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
  const list = filterPosts(await allPublicPosts(), { tree_type: tree || null })

  return (
    <div className={cn(shell, "h-auto min-h-full")}>
      <div className={gallery}>
        <header>
          <h1 className="mb-2 text-2xl text-[#eee]">Graphs</h1>
          <p className="mb-4 max-w-xl leading-snug">Open a graph, copy it, paste it in Blender. To publish one, paste it first.</p>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Link
                key={f.id}
                className={cn(
                  "rounded border border-[#555] bg-[#303030] px-3 py-1.5 text-[13px] text-nv-fg no-underline",
                  tree === f.id && "border-[#888] text-white",
                )}
                href={f.id ? `/?tree=${f.id}` : "/"}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </header>
        <CoverGrid posts={list} />
        {list.length === 0 ? <p className="max-w-md text-center text-xl leading-snug">No posts in this filter.</p> : null}
      </div>
    </div>
  )
}
