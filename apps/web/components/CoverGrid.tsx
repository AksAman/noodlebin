import { CoverMedia } from "@/components/CoverMedia"
import { GraphThumb } from "@/components/GraphThumb"
import { ShaderCover } from "@/components/ShaderCover"
import { treeTypeLabel } from "@/lib/ingest"
import type { NoodleBinPost } from "@/lib/posts"
import { treeDotClass } from "@/lib/ui"
import Link from "next/link"

function shortVersion(version: string): string {
  return version.replace(/_LTS$/i, " LTS")
}

export function CoverGrid({ posts, showAuthor = true }: { posts: NoodleBinPost[]; showAuthor?: boolean }) {
  return (
    <ul className="m-0 list-none columns-1 gap-x-6 p-0 sm:columns-2 lg:columns-3">
      {posts.map((post, i) => (
        <li
          key={post.slug}
          className="mb-10 animate-rise break-inside-avoid"
          style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
        >
          <Link className="group block rounded-lg text-inherit no-underline" href={`/p/${post.slug}`}>
            <div className="relative overflow-hidden rounded-lg bg-canvas ring-1 ring-line">
              <div className="transition-transform duration-500 ease-out-quart group-hover:scale-[1.025]">
                {post.cover_video && post.cover_url ? (
                  <CoverMedia url={post.cover_url} video className="block aspect-video w-full object-cover" />
                ) : post.cover_shader ? (
                  <ShaderCover source={post.cover_shader} poster={post.cover_url} className="aspect-video" />
                ) : post.cover_url ? (
                  <CoverMedia url={post.cover_url} className="block h-auto w-full" />
                ) : post.tree ? (
                  <GraphThumb payload={post.tree} id={post.slug} />
                ) : (
                  <div className="aspect-[4/3]" />
                )}
              </div>
              {post.cover_shader ? (
                <span className="absolute left-2.5 top-2.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-white/85 backdrop-blur-sm">
                  GLSL
                </span>
              ) : null}
              {post.visibility === "unlisted" ? (
                <span className="absolute right-2.5 top-2.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] tracking-wide text-white/85 backdrop-blur-sm">
                  Unlisted
                </span>
              ) : null}
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
                  <span>{post.author_slug ? `@${post.author_slug}` : "Anonymous"}</span>
                </>
              ) : null}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
