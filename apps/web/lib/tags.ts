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
