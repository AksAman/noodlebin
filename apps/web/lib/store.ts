import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import type { NodeVaultPayload } from "@/interchange"
import { posts as seedPosts, type VaultPost } from "@/lib/posts"
import {
  hashEditToken,
  newEditToken,
  uniqueSlug,
  slugify,
  tokenMatches,
  type NewPostInput,
  type SharingError,
} from "@/lib/sharing"

export type StoredPost = VaultPost & {
  edit_token_hash: string
  cover_file: string | null
  video_file: string | null
  blend_file: string | null
}

type DiskShape = { posts: StoredPost[] }

const writeChain = new Map<string, Promise<unknown>>()

export function dataDir(): string {
  const fromEnv = process.env["NODEVAULT_DATA_DIR"]
  if (fromEnv) return resolve(fromEnv)
  return join(process.cwd(), ".data")
}

function catalogPath(dir: string): string {
  return join(dir, "posts.json")
}

function publicOf(post: StoredPost): VaultPost {
  return {
    slug: post.slug,
    title: post.title,
    author_name: post.author_name,
    author_slug: post.author_slug,
    description: post.description,
    tree: post.tree,
    tree_type: post.tree_type,
    blender_version_string: post.blender_version_string,
    cover_url: post.cover_url,
    video_url: post.video_url,
    blend_url: post.blend_url,
    blend_filename: post.blend_filename,
    card_url: post.card_url,
    nodevember_day: post.nodevember_day,
    created_at: post.created_at,
    seeded: post.seeded,
  }
}

async function readDisk(dir: string): Promise<StoredPost[]> {
  try {
    const raw = await readFile(catalogPath(dir), "utf8")
    const parsed = JSON.parse(raw) as DiskShape
    return Array.isArray(parsed.posts) ? parsed.posts : []
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === "ENOENT") return []
    throw err
  }
}

async function writeDisk(dir: string, posts: StoredPost[]): Promise<void> {
  const path = catalogPath(dir)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify({ posts }, null, 2)}\n`)
}

function withLock<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeChain.get(dir) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  writeChain.set(
    dir,
    next.then(
      () => undefined,
      () => undefined,
    ),
  )
  return next
}

export async function listStored(dir = dataDir()): Promise<StoredPost[]> {
  return readDisk(dir)
}

export async function allPublicPosts(dir = dataDir()): Promise<VaultPost[]> {
  const stored = (await listStored(dir)).map(publicOf)
  const bySlug = new Map<string, VaultPost>()
  for (const post of seedPosts) bySlug.set(post.slug, post)
  for (const post of stored) bySlug.set(post.slug, post)
  return [...bySlug.values()]
}

export async function getPublicPost(slug: string, dir = dataDir()): Promise<VaultPost | undefined> {
  const stored = (await listStored(dir)).find((p) => p.slug === slug)
  if (stored) return publicOf(stored)
  return seedPosts.find((p) => p.slug === slug)
}

export async function getStoredPost(slug: string, dir = dataDir()): Promise<StoredPost | undefined> {
  return (await listStored(dir)).find((p) => p.slug === slug)
}

async function writeFileSafe(path: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
}

export async function createStoredPost(
  input: NewPostInput,
  dir = dataDir(),
): Promise<{ post: VaultPost; edit_token: string; url: string }> {
  return withLock(dir, async () => {
    const existing = await allPublicPosts(dir)
    const slug = uniqueSlug(slugify(input.title), new Set(existing.map((p) => p.slug)))
    const token = newEditToken()
    const coverRel = join("files", slug, `cover.${input.files.cover.ext}`)
    await writeFileSafe(join(dir, coverRel), input.files.cover.bytes)

    let video_url: string | null = null
    let video_file: string | null = null
    if (input.files.video) {
      video_file = join("files", slug, `video.${input.files.video.ext}`)
      await writeFileSafe(join(dir, video_file), input.files.video.bytes)
      video_url = `/api/media/${slug}/video`
    }

    let blend_url: string | null = null
    let blend_file: string | null = null
    let blend_filename: string | null = null
    if (input.files.blend) {
      blend_file = join("files", slug, `graph.blend`)
      await writeFileSafe(join(dir, blend_file), input.files.blend.bytes)
      blend_url = `/api/media/${slug}/blend`
      blend_filename = input.files.blend.filename ?? "graph.blend"
    }

    const stored: StoredPost = {
      slug,
      title: input.title,
      author_name: input.author_name,
      author_slug: input.author_slug,
      description: input.description,
      tree: input.tree,
      tree_type: input.tree_type,
      blender_version_string: input.blender_version_string,
      cover_url: `/api/media/${slug}/cover`,
      video_url,
      blend_url,
      blend_filename,
      card_url: `/p/${slug}/opengraph-image`,
      nodevember_day: input.nodevember_day,
      created_at: new Date().toISOString(),
      seeded: false,
      edit_token_hash: hashEditToken(token),
      cover_file: coverRel,
      video_file,
      blend_file,
    }

    const posts = await readDisk(dir)
    posts.push(stored)
    await writeDisk(dir, posts)
    return { post: publicOf(stored), edit_token: token, url: `/p/${slug}` }
  })
}

export async function patchStoredPost(
  slug: string,
  token: string,
  patch: {
    tree?: NodeVaultPayload | null
    cover?: NewPostInput["files"]["cover"]
    video?: NewPostInput["files"]["video"]
    blend?: NewPostInput["files"]["blend"]
  },
  dir = dataDir(),
): Promise<{ post: VaultPost } | SharingError> {
  return withLock(dir, async () => {
    const posts = await readDisk(dir)
    const index = posts.findIndex((p) => p.slug === slug)
    if (index < 0) {
      if (seedPosts.some((p) => p.slug === slug)) {
        return { ok: false as const, status: 403, error: "Fixture posts cannot be edited." }
      }
      return { ok: false as const, status: 404, error: "Post not found." }
    }
    const current = posts[index]
    if (!current || !tokenMatches(token, current.edit_token_hash)) {
      return { ok: false as const, status: 401, error: "Edit token does not match." }
    }

    if (patch.tree !== undefined) {
      current.tree = patch.tree
      if (patch.tree) {
        current.tree_type = patch.tree.tree_type
        current.blender_version_string = patch.tree.blender_version_string
      }
    }
    if (patch.cover) {
      const coverRel = join("files", slug, `cover.${patch.cover.ext}`)
      await writeFileSafe(join(dir, coverRel), patch.cover.bytes)
      current.cover_file = coverRel
      current.cover_url = `/api/media/${slug}/cover`
    }
    if (patch.video) {
      const videoRel = join("files", slug, `video.${patch.video.ext}`)
      await writeFileSafe(join(dir, videoRel), patch.video.bytes)
      current.video_file = videoRel
      current.video_url = `/api/media/${slug}/video`
    }
    if (patch.blend) {
      const blendRel = join("files", slug, "graph.blend")
      await writeFileSafe(join(dir, blendRel), patch.blend.bytes)
      current.blend_file = blendRel
      current.blend_url = `/api/media/${slug}/blend`
      current.blend_filename = patch.blend.filename ?? "graph.blend"
    }

    posts[index] = current
    await writeDisk(dir, posts)
    return { post: publicOf(current) }
  })
}

export async function readMediaFile(
  slug: string,
  kind: "cover" | "video" | "blend",
  dir = dataDir(),
): Promise<{ bytes: Buffer; type: string; filename: string } | null> {
  const post = await getStoredPost(slug, dir)
  if (!post) return null
  const rel = kind === "cover" ? post.cover_file : kind === "video" ? post.video_file : post.blend_file
  if (!rel) return null
  const bytes = await readFile(join(dir, rel))
  if (kind === "cover") {
    const ext = rel.split(".").pop()
    const type = ext === "jpg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/png"
    return { bytes, type, filename: `cover.${ext ?? "png"}` }
  }
  if (kind === "video") return { bytes, type: "video/mp4", filename: "video.mp4" }
  return { bytes, type: "application/octet-stream", filename: post.blend_filename ?? "graph.blend" }
}
