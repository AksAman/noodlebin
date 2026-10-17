import { uniqueSlug } from "@/lib/sharing"

/** A public handle. Empty or symbol-only names become "user", never "post". */
export function handleBase(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
  return slug || "user"
}

export function claimHandle(name: string, taken: Set<string>): string {
  return uniqueSlug(handleBase(name), taken)
}

/** Username from an OAuth profile. Display names are not handles. */
export function providerUsername(oauth: { providerId?: string; profile?: unknown } | undefined): string | undefined {
  const profile = oauth?.profile
  if (!profile || typeof profile !== "object") return undefined
  if (oauth.providerId === "twitter") {
    const data = (profile as { data?: { username?: unknown } }).data
    return typeof data?.username === "string" && data.username ? data.username : undefined
  }
  if (oauth.providerId === "discord") {
    const username = (profile as { username?: unknown }).username
    return typeof username === "string" && username ? username : undefined
  }
  return undefined
}
