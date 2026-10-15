import { treeTypeLabel } from "@/lib/ingest"
import type { VaultPost } from "@/lib/posts"
import { treeArtClass } from "@/lib/ui"
import Link from "next/link"

export function CoverGrid({ posts, showAuthor = true }: { posts: VaultPost[]; showAuthor?: boolean }) {
  return (
    <ul className="mt-6 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 p-0">
      {posts.map((post) => (
        <li key={post.slug}>
          <Link
            className="flex flex-col overflow-hidden rounded-md border border-nv-line bg-nv-raised text-inherit no-underline"
            href={`/p/${post.slug}`}
          >
            {post.cover_url ? (
              <img className="block min-h-[120px] w-full object-cover" src={post.cover_url} alt="" />
            ) : (
              <div className={treeArtClass(post.tree_type)} />
            )}
            <div className="flex flex-col gap-1 px-3 pb-3 pt-2.5 text-[13px]">
              <strong>{post.title}</strong>
              <span className="text-xs text-[#888]">
                {showAuthor ? `@${post.author_slug} · ` : ""}
                {treeTypeLabel(post.tree_type)} · {post.blender_version_string}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
