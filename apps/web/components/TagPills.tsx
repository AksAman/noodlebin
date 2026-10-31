"use client"

import { addTag, suggestTags, TAG_LIMIT } from "@/lib/tags"
import { cn, field } from "@/lib/ui"
import { useId, useRef, useState } from "react"

export function TagPills({
  tags,
  onChange,
  suggestions,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
}) {
  const [draft, setDraft] = useState("")
  const [focused, setFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const full = tags.length >= TAG_LIMIT

  const options =
    focused && suggestions && !full
      ? suggestTags(suggestions, tags, draft)
      : []
  const isOpen = options.length > 0

  function commit(raw: string) {
    const next = addTag(tags, raw)
    if (next !== tags) onChange(next)
    setDraft("")
    setActiveIndex(-1)
  }

  return (
    <div className="relative">
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
          ref={inputRef}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={isOpen ? listId : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-[14px] text-fg outline-none placeholder:text-subtle disabled:placeholder:text-line"
          value={draft}
          disabled={full}
          placeholder={tags.length === 0 ? "Add a tag" : full ? "8 tags is the limit" : "Add another"}
          aria-label="Add a tag"
          data-tag-draft=""
          onChange={(event) => {
            setDraft(event.target.value)
            setActiveIndex(-1)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            setActiveIndex(-1)
            if (draft.trim()) commit(draft)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setActiveIndex((i) => Math.min(i + 1, options.length - 1))
              return
            }
            if (event.key === "ArrowUp") {
              event.preventDefault()
              setActiveIndex((i) => Math.max(i - 1, -1))
              return
            }
            if (event.key === "Escape") {
              setActiveIndex(-1)
              setFocused(false)
              inputRef.current?.blur()
              return
            }
            if (event.key === "Enter") {
              event.preventDefault()
              if (activeIndex >= 0 && options[activeIndex]) {
                commit(options[activeIndex])
              } else {
                commit(event.currentTarget.value)
              }
              return
            }
            if (event.key === "Backspace" && event.currentTarget.value === "" && tags.length > 0) {
              event.preventDefault()
              onChange(tags.slice(0, -1))
            }
          }}
        />
      </div>

      {isOpen ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Tag suggestions"
          className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-line bg-bg py-1 shadow-md"
        >
          {options.map((tag, i) => (
            <li
              key={tag}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={cn(
                "cursor-pointer px-3 py-1.5 text-[13px] text-fg",
                i === activeIndex ? "bg-sunken" : "hover:bg-sunken",
              )}
              onMouseDown={(event) => {
                // Prevent blur from firing before click
                event.preventDefault()
                commit(tag)
                inputRef.current?.focus()
              }}
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
