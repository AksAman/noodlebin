import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import type { NodeVaultPayload } from "@/interchange"
import { pgGet, pgInsert, pgList, pgSlugs, pgUpdate, usesPostgres } from "@/lib/db"
import { isSafeSlug, mediaUrl, readMediaBytes, writeMedia } from "@/lib/media"
import { posts as seedPosts, type StoredPost, type VaultPost } from "@/lib/posts"
import {
  hashEditToken,
  newEditToken,
  uniqueSlug,
  slugify,
  tokenMatches,
  type NewPostInput,
  type PostLinks,
  type SharingError,
} from "@/lib/sharing"

export type { StoredPost }

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
    cover_shader: post.cover_shader ?? null,
    video_url: post.video_url,
    youtube_url: post.youtube_url ?? null,
    tweet_url: post.tweet_url ?? null,
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
  if (usesPostgres()) return pgList()
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
  if (!isSafeSlug(slug)) return undefined
  const stored = await getStoredPost(slug, dir)
  if (stored) return publicOf(stored)
  return seedPosts.find((p) => p.slug === slug)
}

export async function getStoredPost(slug: string, dir = dataDir()): Promise<StoredPost | undefined> {
  if (!isSafeSlug(slug)) return undefined
  if (usesPostgres()) return pgGet(slug)
  return (await readDisk(dir)).find((p) => p.slug === slug)
}

async function takenSlugs(dir: string): Promise<Set<string>> {
  const slugs = usesPostgres() ? await pgSlugs() : (await readDisk(dir)).map((p) => p.slug)
  return new Set([...seedPosts.map((p) => p.slug), ...slugs])
}

async function persistNew(dir: string, stored: StoredPost): Promise<void> {
  if (usesPostgres()) {
    await pgInsert(stored)
    return
  }
  const posts = await readDisk(dir)
  posts.push(stored)
  await writeDisk(dir, posts)
}

async function persistPatch(dir: string, stored: StoredPost): Promise<void> {
  if (usesPostgres()) {
    await pgUpdate(stored)
    return
  }
  const posts = await readDisk(dir)
  const index = posts.findIndex((p) => p.slug === stored.slug)
  if (index < 0) throw new Error("Post missing during patch.")
  posts[index] = stored
  await writeDisk(dir, posts)
}

async function buildStored(
  input: NewPostInput,
  slug: string,
  token: string,
  dir: string,
): Promise<StoredPost> {
  const coverRel = join("files", slug, `cover.${input.files.cover.ext}`)
  const coverStored = await writeMedia(dir, coverRel, input.files.cover.bytes, input.files.cover.type)

  let video_file: string | null = null
  if (input.files.video) {
    const videoRel = join("files", slug, `video.${input.files.video.ext}`)
    video_file = await writeMedia(dir, videoRel, input.files.video.bytes, input.files.video.type)
  }

  let blend_file: string | null = null
  let blend_filename: string | null = null
  if (input.files.blend) {
    const blendRel = join("files", slug, "graph.blend")
    blend_file = await writeMedia(dir, blendRel, input.files.blend.bytes, "application/octet-stream")
    blend_filename = input.files.blend.filename ?? "graph.blend"
  }

  return {
    slug,
    title: input.title,
    author_name: input.author_name,
    author_slug: input.author_slug,
    description: input.description,
    tree: input.tree,
    tree_type: input.tree_type,
    blender_version_string: input.blender_version_string,
    cover_url: mediaUrl(slug, "cover", coverStored),
    cover_shader: input.cover_shader,
    video_url: mediaUrl(slug, "video", video_file),
    youtube_url: input.youtube_url,
    tweet_url: input.tweet_url,
    blend_url: mediaUrl(slug, "blend", blend_file),
    blend_filename,
    card_url: `/p/${slug}/opengraph-image`,
    nodevember_day: input.nodevember_day,
    created_at: new Date().toISOString(),
    seeded: false,
    edit_token_hash: hashEditToken(token),
    cover_file: coverStored,
    video_file,
    blend_file,
  }
}

export async function createStoredPost(
  input: NewPostInput,
  dir = dataDir(),
): Promise<{ post: VaultPost; edit_token: string; url: string }> {
  const run = async () => {
    const slug = uniqueSlug(slugify(input.title), await takenSlugs(dir))
    const token = newEditToken()
    const stored = await buildStored(input, slug, token, dir)
    await persistNew(dir, stored)
    return { post: publicOf(stored), edit_token: token, url: `/p/${slug}` }
  }
  return usesPostgres() ? run() : withLock(dir, run)
}

export async function patchStoredPost(
  slug: string,
  token: string,
  patch: {
    tree?: NodeVaultPayload | null
    cover?: NewPostInput["files"]["cover"]
    video?: NewPostInput["files"]["video"]
    blend?: NewPostInput["files"]["blend"]
  } & PostLinks,
  dir = dataDir(),
): Promise<{ post: VaultPost } | SharingError> {
  const run = async (): Promise<{ post: VaultPost } | SharingError> => {
    if (!isSafeSlug(slug)) return { ok: false, status: 404, error: "Post not found." }
    const current = await getStoredPost(slug, dir)
    if (!current) {
      if (seedPosts.some((p) => p.slug === slug)) {
        return { ok: false, status: 403, error: "Fixture posts cannot be edited." }
      }
      return { ok: false, status: 404, error: "Post not found." }
    }
    if (!tokenMatches(token, current.edit_token_hash)) {
      return { ok: false, status: 401, error: "Edit token does not match." }
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
      current.cover_file = await writeMedia(dir, coverRel, patch.cover.bytes, patch.cover.type)
      current.cover_url = mediaUrl(slug, "cover", current.cover_file)
    }
    if (patch.video) {
      const videoRel = join("files", slug, `video.${patch.video.ext}`)
      current.video_file = await writeMedia(dir, videoRel, patch.video.bytes, patch.video.type)
      current.video_url = mediaUrl(slug, "video", current.video_file)
    }
    if (patch.blend) {
      const blendRel = join("files", slug, "graph.blend")
      current.blend_file = await writeMedia(dir, blendRel, patch.blend.bytes, "application/octet-stream")
      current.blend_url = mediaUrl(slug, "blend", current.blend_file)
      current.blend_filename = patch.blend.filename ?? "graph.blend"
    }
    if (patch.youtube_url !== undefined) current.youtube_url = patch.youtube_url
    if (patch.tweet_url !== undefined) current.tweet_url = patch.tweet_url
    if (patch.cover_shader !== undefined) current.cover_shader = patch.cover_shader

    await persistPatch(dir, current)
    return { post: publicOf(current) }
  }
  return usesPostgres() ? run() : withLock(dir, run)
}

export async function readMediaFile(
  slug: string,
  kind: "cover" | "video" | "blend",
  dir = dataDir(),
): Promise<{ bytes: Buffer; type: string; filename: string } | null> {
  if (!isSafeSlug(slug)) return null
  const post = await getStoredPost(slug, dir)
  if (!post) return null
  const rel = kind === "cover" ? post.cover_file : kind === "video" ? post.video_file : post.blend_file
  if (!rel) return null
  const bytes = await readMediaBytes(dir, rel)
  if (!bytes) return null
  if (kind === "cover") {
    const ext = rel.split(".").pop()?.split("?")[0]
    const type = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/png"
    return { bytes, type, filename: `cover.${ext && ext.length <= 4 ? ext : "png"}` }
  }
  if (kind === "video") return { bytes, type: "video/mp4", filename: "video.mp4" }
  const filename = post.blend_filename ?? "graph.blend"
  const safeName = filename.replace(/[\r\n"]/g, "").slice(0, 120) || "graph.blend"
  return { bytes, type: "application/octet-stream", filename: safeName }
}
