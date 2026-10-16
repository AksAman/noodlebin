"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export function GallerySearch({
  tree,
  tag,
  q,
}: {
  tree: string
  tag: string
  q: string
}) {
  const router = useRouter()
  const [value, setValue] = useState(q)

  useEffect(() => {
    setValue(q)
  }, [q])

  useEffect(() => {
    const next = value.trim()
    if (next === q) return
    const id = setTimeout(() => {
      const params = new URLSearchParams()
      if (tree) params.set("tree", tree)
      if (tag) params.set("tag", tag)
      if (next) params.set("q", next)
      const query = params.toString()
      router.replace(query ? `/?${query}` : "/", { scroll: false })
    }, 300)
    return () => clearTimeout(id)
  }, [value, q, tree, tag, router])

  return (
    <input
      className="mb-6 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[14px] text-fg placeholder:text-subtle focus-visible:border-accent focus-visible:outline-none"
      type="search"
      value={value}
      placeholder="Search titles, notes, tags, and nodes"
      aria-label="Search graphs"
      onChange={(event) => setValue(event.target.value)}
    />
  )
}
