"use client"

import { addTag, TAG_LIMIT } from "@/lib/tags"
import { cn, field } from "@/lib/ui"
import { useState } from "react"

export function TagPills({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const full = tags.length >= TAG_LIMIT

  function commit(raw: string) {
    const next = addTag(tags, raw)
    if (next !== tags) onChange(next)
    setDraft("")
  }

  return (
    <div className={cn(field, "flex min-h-11 flex-wrap items-center gap-1.5 py-1.5")}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-sunken py-0.5 pl-2.5 pr-1 text-[12px] font-normal text-fg"
        >
          {tag}
          <button
            type="button"
            className="grid size-4 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-muted hover:bg-line hover:text-fg"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(tags.filter((item) => item !== tag))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-[14px] text-fg outline-none placeholder:text-subtle disabled:placeholder:text-line"
        value={draft}
        disabled={full}
        placeholder={tags.length === 0 ? "Add a tag" : full ? "8 tags is the limit" : "Add another"}
        aria-label="Add a tag"
        data-tag-draft=""
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit(event.currentTarget.value)
            return
          }
          if (event.key === "Backspace" && event.currentTarget.value === "" && tags.length > 0) {
            event.preventDefault()
            onChange(tags.slice(0, -1))
          }
        }}
        onBlur={() => {
          if (draft.trim()) commit(draft)
        }}
      />
    </div>
  )
}
