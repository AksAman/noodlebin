export const TAG_LIMIT = 8

/** Lowercase token stored for a tag. Spaces become hyphens. */
export function tagToken(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
}

export function addTag(existing: string[], raw: string): string[] {
  const token = tagToken(raw)
  if (!token || existing.includes(token) || existing.length >= TAG_LIMIT) return existing
  return [...existing, token]
}

/**
 * Returns up to `max` suggestions from `all` (pre-sorted by popularity).
 * When `draft` is non-empty, prefix matches come first, then substring matches.
 * When `draft` is empty, returns the most popular tags not already chosen.
 * Returns [] if the user has already reached TAG_LIMIT.
 */
export function suggestTags(
  all: string[],
  chosen: string[],
  draft: string,
  max = 6,
): string[] {
  if (chosen.length >= TAG_LIMIT) return []
  const token = tagToken(draft)
  const available = all.filter((t) => !chosen.includes(t))
  if (!token) return available.slice(0, max)
  const prefix: string[] = []
  const rest: string[] = []
  for (const t of available) {
    if (t.startsWith(token)) prefix.push(t)
    else if (t.includes(token)) rest.push(t)
    if (prefix.length + rest.length >= max * 2) break
  }
  return [...prefix, ...rest].slice(0, max)
}
