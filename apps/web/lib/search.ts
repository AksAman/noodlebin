import type { NoodleBinPayload } from "@/interchange"

export type SearchablePost = {
  title: string
  description: string | null
  author_name: string
  tags: string[]
  tree: NoodleBinPayload | null
}

/** Text stored once at publish time and matched by gallery search. */
export function buildSearchText(post: SearchablePost): string {
  const nodes: string[] = []
  for (const tree of post.tree?.trees ?? []) {
    for (const node of tree.nodes) {
      if (node.name) nodes.push(node.name)
      if (node.label) nodes.push(node.label)
      if (node.bl_idname) nodes.push(node.bl_idname)
    }
  }
  return [post.title, post.description ?? "", post.author_name, ...post.tags, ...nodes].join(" ").toLowerCase()
}

/**
 * Higher means a closer hit. Each word takes its best field:
 * title, then tag, note, author, node name, and last the Blender type
 * (`ShaderNodeValToRGB` matching "rgb"). Zero means some word is missing.
 */
export function searchScore(post: SearchablePost, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return 0
  let total = 0
  for (const term of terms) {
    const score = scoreTerm(post, term)
    if (score === 0) return 0
    total += score
  }
  return total
}

function scoreTerm(post: SearchablePost, term: string): number {
  const has = (value: string) => value.toLowerCase().includes(term)
  if (has(post.title)) return 100
  if (post.tags.some((tag) => has(tag))) return 80
  if (post.description && has(post.description)) return 40
  if (has(post.author_name)) return 30
  let best = 0
  for (const tree of post.tree?.trees ?? []) {
    for (const node of tree.nodes) {
      if ((node.name && has(node.name)) || (node.label && has(node.label))) best = Math.max(best, 20)
      else if (node.bl_idname && has(node.bl_idname)) best = Math.max(best, 5)
    }
  }
  return best
}
