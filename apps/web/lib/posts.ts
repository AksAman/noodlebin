import { parseNodeVaultText, type NodeVaultPayload, type TreeType } from "@/interchange"
import frameChild from "@/fixtures/handwritten/frame-child.nodevault.json"
import groupInner from "@/fixtures/handwritten/group-inner.nodevault.json"
import threeStopRamp from "@/fixtures/handwritten/three-stop-ramp.nodevault.json"
import workedExample from "@/fixtures/handwritten/worked-example-shader.nodevault.json"

export type StaticPost = {
  slug: string
  title: string
  author_name: string
  author_slug: string
  description: string
  tree: NodeVaultPayload
  tree_type: TreeType
  blender_version_string: string
}

function fromJson(value: unknown): NodeVaultPayload {
  return parseNodeVaultText(JSON.stringify(value))
}

function post(
  slug: string,
  title: string,
  tree: NodeVaultPayload,
  description: string,
  author_slug = "nodevault",
  author_name = "NodeVault",
): StaticPost {
  return {
    slug,
    title,
    author_name,
    author_slug,
    description,
    tree,
    tree_type: tree.tree_type,
    blender_version_string: tree.blender_version_string,
  }
}

export const posts: StaticPost[] = [
  post(
    "noise-roughness",
    "Noise into Principled",
    fromJson(workedExample),
    "Two shader nodes from the interchange fixture.",
  ),
  post(
    "three-stop-ramp",
    "Three-stop Color Ramp",
    fromJson(threeStopRamp),
    "A Color Ramp with three elements.",
  ),
  post(
    "frame-child",
    "RGB in a frame",
    fromJson(frameChild),
    "A child node parented to a frame.",
  ),
  post(
    "group-inner",
    "Group with an inner tree",
    fromJson(groupInner),
    "A group instance and its inner RGB node.",
  ),
]

export function postBySlug(slug: string): StaticPost | undefined {
  return posts.find((p) => p.slug === slug)
}

export function postsByAuthor(author_slug: string): StaticPost[] {
  return posts.filter((p) => p.author_slug === author_slug)
}

export function postsFiltered(treeType: string | null): StaticPost[] {
  if (!treeType) return posts
  return posts.filter((p) => p.tree_type === treeType)
}
