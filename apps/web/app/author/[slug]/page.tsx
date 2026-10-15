import { CoverGrid } from "@/components/CoverGrid"
import { filterPosts } from "@/lib/posts"
import { allPublicPosts } from "@/lib/store"
import { cn, gallery, shell } from "@/lib/ui"

export const dynamic = "force-dynamic"

export default async function AuthorRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const list = filterPosts(await allPublicPosts(), { author: slug })

  return (
    <div className={cn(shell, "h-auto min-h-full")}>
      <div className={gallery}>
        <header>
          <h1 className="mb-2 text-2xl text-[#eee]">@{slug}</h1>
          {list[0] ? (
            <p className="mb-4 max-w-xl leading-snug">{list[0].author_name}</p>
          ) : (
            <p className="mb-4 max-w-xl leading-snug">No posts for this author.</p>
          )}
        </header>
        <CoverGrid posts={list} showAuthor={false} />
      </div>
    </div>
  )
}
