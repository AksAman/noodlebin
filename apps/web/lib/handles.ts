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
