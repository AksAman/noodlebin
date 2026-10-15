import { parseNodeVaultText, type NodeVaultPayload, type TreeType } from "@/interchange"
import frameChild from "@/fixtures/handwritten/frame-child.nodevault.json"
import groupInner from "@/fixtures/handwritten/group-inner.nodevault.json"
import threeStopRamp from "@/fixtures/handwritten/three-stop-ramp.nodevault.json"
import workedExample from "@/fixtures/handwritten/worked-example-shader.nodevault.json"

export type VaultPost = {
  slug: string
  title: string
  author_name: string
  author_slug: string
  description: string | null
  tree: NodeVaultPayload | null
  tree_type: TreeType
  blender_version_string: string
  cover_url: string | null
  video_url: string | null
  blend_url: string | null
  blend_filename: string | null
  card_url: string | null
  nodevember_day: number | null
  created_at: string
  seeded: boolean
}

export type StaticPost = VaultPost

function fromJson(value: unknown): NodeVaultPayload {
  return parseNodeVaultText(JSON.stringify(value))
}

function seed(
  slug: string,
  title: string,
  tree: NodeVaultPayload,
  description: string,
  created_at: string,
): VaultPost {
  return {
    slug,
    title,
    author_name: "NodeVault",
    author_slug: "nodevault",
    description,
    tree,
    tree_type: tree.tree_type,
    blender_version_string: tree.blender_version_string,
    cover_url: null,
    video_url: null,
    blend_url: null,
    blend_filename: null,
    card_url: `/p/${slug}/opengraph-image`,
    nodevember_day: null,
    created_at,
    seeded: true,
  }
}

export const posts: VaultPost[] = [
  seed(
    "noise-roughness",
    "Noise into Principled",
    fromJson(workedExample),
    "Two shader nodes from the interchange fixture.",
    "2026-01-01T00:00:00.000Z",
  ),
  seed(
    "three-stop-ramp",
    "Three-stop Color Ramp",
    fromJson(threeStopRamp),
    "A Color Ramp with three elements.",
    "2026-01-02T00:00:00.000Z",
  ),
  seed(
    "frame-child",
    "RGB in a frame",
    fromJson(frameChild),
    "A child node parented to a frame.",
    "2026-01-03T00:00:00.000Z",
  ),
  seed(
    "group-inner",
    "Group with an inner tree",
    fromJson(groupInner),
    "A group instance and its inner RGB node.",
    "2026-01-04T00:00:00.000Z",
  ),
]

export function toPublicPost(post: VaultPost): VaultPost {
  return post
}

export function postBySlug(slug: string): VaultPost | undefined {
  return posts.find((p) => p.slug === slug)
}

export function postsByAuthor(author_slug: string): VaultPost[] {
  return posts.filter((p) => p.author_slug === author_slug)
}

export function postsFiltered(treeType: string | null): VaultPost[] {
  if (!treeType) return posts
  return posts.filter((p) => p.tree_type === treeType)
}

export function filterPosts(
  list: VaultPost[],
  query: { author?: string | null; tree_type?: string | null },
): VaultPost[] {
  let out = list
  if (query.author) out = out.filter((p) => p.author_slug === query.author)
  if (query.tree_type) out = out.filter((p) => p.tree_type === query.tree_type)
  return [...out].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
}

export function takenSlugs(list: VaultPost[]): Set<string> {
  return new Set(list.map((p) => p.slug))
}
