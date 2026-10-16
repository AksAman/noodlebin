import { CoverGrid } from "@/components/CoverGrid"
import { filterPosts } from "@/lib/posts"
import { allPublicPosts } from "@/lib/store"
import { docShell, page } from "@/lib/ui"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function AuthorRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const list = filterPosts(await allPublicPosts(), { author: slug })
  const name = list[0]?.author_name

  return (
    <div className={docShell}>
      <div className={page}>
        <header className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-line pb-8 pt-14 sm:pt-20">
          <div
            aria-hidden="true"
            className="grid size-16 place-items-center rounded-full bg-sunken font-display text-2xl font-semibold uppercase text-muted ring-1 ring-line"
          >
            {(name ?? slug).slice(0, 1)}
          </div>
          <div className="min-w-0">
            <h1 className="m-0 font-display text-[clamp(2rem,1.4rem+2.4vw,3.25rem)] font-semibold leading-none tracking-[-0.03em] text-fg">
              {name ?? `@${slug}`}
            </h1>
            <p className="mt-2 text-[14px] text-muted tabular-nums">
              {name ? `@${slug} · ` : ""}
              {list.length} graph{list.length === 1 ? "" : "s"}
            </p>
          </div>
        </header>
        {list.length > 0 ? (
          <div className="pt-10">
            <CoverGrid posts={list} showAuthor={false} />
          </div>
        ) : (
          <div className="py-16">
            <p className="m-0 font-display text-2xl text-fg">No graphs from @{slug} yet.</p>
            <p className="mt-2 text-muted">
              <Link className="text-accent-fg underline-offset-4 hover:underline" href="/">
                Browse the gallery
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
