import { GraphThumb } from "@/components/GraphThumb"
import { treeTypeLabel } from "@/lib/ingest"
import type { VaultPost } from "@/lib/posts"
import { treeDotClass } from "@/lib/ui"
import Link from "next/link"

function shortVersion(version: string): string {
  return version.replace(/_LTS$/i, " LTS")
}

export function CoverGrid({ posts, showAuthor = true }: { posts: VaultPost[]; showAuthor?: boolean }) {
  return (
    <ul className="m-0 list-none columns-1 gap-x-6 p-0 sm:columns-2 lg:columns-3">
      {posts.map((post, i) => (
        <li
          key={post.slug}
          className="mb-10 animate-rise break-inside-avoid"
          style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
        >
          <Link className="group block rounded-lg text-inherit no-underline" href={`/p/${post.slug}`}>
            <div className="overflow-hidden rounded-lg bg-canvas ring-1 ring-line">
              <div className="transition-transform duration-500 ease-out-quart group-hover:scale-[1.025]">
                {post.cover_url ? (
                  <img className="block h-auto w-full" src={post.cover_url} alt="" loading="lazy" />
                ) : post.tree ? (
                  <GraphThumb payload={post.tree} id={post.slug} />
                ) : (
                  <div className="aspect-[4/3]" />
                )}
              </div>
            </div>
            <h2 className="mt-3.5 font-display text-[18px] font-medium leading-snug tracking-[-0.01em] text-fg decoration-line-strong underline-offset-4 group-hover:underline">
              {post.title}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <span className={treeDotClass(post.tree_type)} aria-hidden="true" />
                {treeTypeLabel(post.tree_type)}
              </span>
              <span aria-hidden="true" className="text-subtle">
                ·
              </span>
              <span>Blender {shortVersion(post.blender_version_string)}</span>
              {showAuthor ? (
                <>
                  <span aria-hidden="true" className="text-subtle">
                    ·
                  </span>
                  <span>@{post.author_slug}</span>
                </>
              ) : null}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
