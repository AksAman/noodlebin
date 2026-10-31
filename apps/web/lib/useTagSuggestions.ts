"use client"

import { useEffect, useState } from "react"

/** Fetches the site-wide popular tags once; silently ignores failures. */
export function useTagSuggestions(): string[] {
  const [suggestions, setSuggestions] = useState<string[]>([])
  useEffect(() => {
    void fetch("/api/tags")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { tags?: string[] } | null) => {
        if (Array.isArray(data?.tags)) setSuggestions(data.tags)
      })
      .catch(() => {})
  }, [])
  return suggestions
}
