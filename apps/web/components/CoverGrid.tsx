import { treeTypeLabel } from "@/lib/ingest"
import type { StaticPost } from "@/lib/posts"
import Link from "next/link"

export function CoverGrid({ posts, showAuthor = true }: { posts: StaticPost[]; showAuthor?: boolean }) {
  return (
    <ul className="cover-grid">
      {posts.map((post) => (
        <li key={post.slug}>
          <Link className="cover-card" href={`/p/${post.slug}`}>
            <div className={`cover-art tree-${post.tree_type}`} />
            <div className="cover-meta">
              <strong>{post.title}</strong>
              <span>
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
