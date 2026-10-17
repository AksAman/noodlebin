import {
  parseNodeVaultText,
  type NodeVaultPayload,
  type TreeType,
} from "@/interchange";
import frameChild from "@/fixtures/handwritten/frame-child.nodevault.json";
import groupInner from "@/fixtures/handwritten/group-inner.nodevault.json";
import homepageNoise from "@/fixtures/handwritten/homepage-noise.nodevault.json";
import threeStopRamp from "@/fixtures/handwritten/three-stop-ramp.nodevault.json";
import workedExample from "@/fixtures/handwritten/worked-example-shader.nodevault.json";
import { halftoneCoverSource } from "@/lib/halftone";
import { buildSearchText, searchScore } from "@/lib/search";

export type Visibility = "public" | "unlisted";

export type VaultPost = {
  slug: string;
  title: string;
  author_name: string;
  author_slug: string | null;
  description: string | null;
  tree: NodeVaultPayload | null;
  tree_type: TreeType;
  blender_version_string: string;
  cover_url: string | null;
  /** Shadertoy-style GLSL (a mainImage function) drawn live over the cover image. */
  cover_shader: string | null;
  video_url: string | null;
  youtube_url: string | null;
  tweet_url: string | null;
  blend_url: string | null;
  blend_filename: string | null;
  card_url: string | null;
  nodevember_day: number | null;
  created_at: string;
  seeded: boolean;
  visibility: Visibility;
  tags: string[];
  search_text: string;
};

export type StoredPost = VaultPost & {
  edit_token_hash: string;
  cover_file: string | null;
  video_file: string | null;
  blend_file: string | null;
  user_id: string | null;
};

export type StaticPost = VaultPost;

export const HOMEPAGE_NOISE_SLUG = "homepage-background";

function fromJson(value: unknown): NodeVaultPayload {
  return parseNodeVaultText(JSON.stringify(value));
}

function seed(
  slug: string,
  title: string,
  tree: NodeVaultPayload,
  description: string,
  created_at: string,
  cover_shader: string | null = null,
): VaultPost {
  const post = {
    slug,
    title,
    author_name: "NodeVault",
    author_slug: "nodevault",
    description,
    tree,
    tree_type: tree.tree_type,
    blender_version_string: tree.blender_version_string,
    cover_url: null,
    cover_shader,
    video_url: null,
    youtube_url: null,
    tweet_url: null,
    blend_url: null,
    blend_filename: null,
    card_url: `/p/${slug}/opengraph-image`,
    nodevember_day: null,
    created_at,
    seeded: true,
    visibility: "public" as const,
    tags: [] as string[],
  };
  return { ...post, search_text: buildSearchText(post) };
}

export const posts: VaultPost[] = [
  seed(
    HOMEPAGE_NOISE_SLUG,
    "The homepage background",
    fromJson(homepageNoise),
    "The halftone shader behind the NodeVault homepage: a Noise Texture sampled once per grid cell, with each dot sized by how bright the Color Ramp makes it. Paste it onto a plane and Blender renders the same dots the homepage shows. Switch the view transform to Standard for matching colors.",
    "2026-01-05T00:00:00.000Z",
    halftoneCoverSource(),
  ),
];

export function toPublicPost(post: VaultPost): VaultPost {
  return post;
}

export function postBySlug(slug: string): VaultPost | undefined {
  return posts.find((p) => p.slug === slug);
}

export function postsByAuthor(author_slug: string): VaultPost[] {
  return posts.filter((p) => p.author_slug === author_slug);
}

export function postsFiltered(treeType: string | null): VaultPost[] {
  if (!treeType) return posts;
  return posts.filter((p) => p.tree_type === treeType);
}

export function filterPosts(
  list: VaultPost[],
  query: {
    author?: string | null;
    tree_type?: string | null;
    q?: string | null;
    tag?: string | null;
  },
): VaultPost[] {
  let out = list.filter((post) => post.visibility !== "unlisted");
  if (query.author) out = out.filter((p) => p.author_slug === query.author);
  if (query.tree_type) out = out.filter((p) => p.tree_type === query.tree_type);
  const tag = query.tag?.trim().toLowerCase();
  if (tag) out = out.filter((p) => p.tags.includes(tag));
  const q = query.q?.trim() ?? "";
  const byDate = (a: VaultPost, b: VaultPost) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
  if (!q) return [...out].sort(byDate);
  return out
    .map((post) => ({ post, score: searchScore(post, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || byDate(a.post, b.post))
    .map((row) => row.post);
}

export function takenSlugs(list: VaultPost[]): Set<string> {
  return new Set(list.map((p) => p.slug));
}
