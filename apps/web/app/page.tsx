import { CoverGrid } from "@/components/CoverGrid"
import { filterPosts } from "@/lib/posts"
import { allPublicPosts } from "@/lib/store"
import { btnAccent, cn, page, docShell, treeDotClass } from "@/lib/ui"
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
    <div className={docShell}>
      <div className={page}>
        <header className="grid gap-x-12 gap-y-6 pb-12 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h1 className="m-0 max-w-[14ch] font-display text-[clamp(2.75rem,1.6rem+4.4vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-fg">
              Steal these graphs.
            </h1>
            <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted">
              Every graph here copies straight back into Blender with its values, links, frames, and groups intact.
            </p>
          </div>
          <Link className={cn(btnAccent, "justify-self-start px-4 py-2.5 text-[14px] lg:self-end")} href="/paste">
            Paste your own
          </Link>
        </header>

        <nav aria-label="Filter by tree type" className="mb-8 flex flex-wrap items-center gap-1.5 border-t border-line pt-5">
          {FILTERS.map((f) => {
            const active = tree === f.id
            return (
              <Link
                key={f.id}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] no-underline transition-colors duration-150",
                  active ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-line-strong hover:text-fg",
                )}
                href={f.id ? `/?tree=${f.id}` : "/"}
              >
                {f.id ? <span className={treeDotClass(f.id)} aria-hidden="true" /> : null}
                {f.label}
              </Link>
            )
          })}
          <span className="ml-auto text-[13px] text-subtle tabular-nums">
            {list.length} graph{list.length === 1 ? "" : "s"}
          </span>
        </nav>

        {list.length > 0 ? (
          <CoverGrid posts={list} />
        ) : (
          <div className="py-16">
            <p className="m-0 font-display text-2xl text-fg">Nothing here yet.</p>
            <p className="mt-2 text-muted">
              No graphs of this type have been shared.{" "}
              <Link className="text-accent-fg underline-offset-4 hover:underline" href="/paste">
                Paste one
              </Link>{" "}
              and be the first.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
