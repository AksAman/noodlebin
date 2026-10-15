import { CoverGrid } from "@/components/CoverGrid"
import { posts, postsByAuthor } from "@/lib/posts"

export function generateStaticParams() {
  const slugs = [...new Set(posts.map((p) => p.author_slug))]
  return slugs.map((slug) => ({ slug }))
}

export default async function AuthorRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const list = postsByAuthor(slug)

  return (
    <div className="app page">
      <div className="gallery">
        <header className="gallery-head">
          <h1>@{slug}</h1>
          {list[0] ? <p>{list[0].author_name}</p> : <p>No posts for this author.</p>}
        </header>
        <CoverGrid posts={list} showAuthor={false} />
      </div>
    </div>
  )
}
