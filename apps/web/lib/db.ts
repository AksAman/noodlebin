import { Prisma, type Post } from "@/generated/prisma/client"
import type { NodeVaultPayload, TreeType } from "@/interchange"
import { ensureSchema } from "@/lib/prisma"
import type { StoredPost } from "@/lib/posts"
import { buildSearchText } from "@/lib/search"
import { env } from "@/env"

export function usesPostgres(): boolean {
  return Boolean(env.DATABASE_URL) && !env.NODEVAULT_DATA_DIR
}

function withSearch(post: StoredPost): StoredPost {
  if (post.search_text) return post
  return { ...post, search_text: buildSearchText(post) }
}

function fromRow(row: Post): StoredPost {
  return withSearch({
    slug: row.slug,
    title: row.title,
    author_name: row.authorName,
    author_slug: row.authorSlug,
    description: row.description,
    tree: (row.tree as NodeVaultPayload | null) ?? null,
    tree_type: row.treeType as TreeType,
    blender_version_string: row.blenderVersionString,
    cover_url: row.coverUrl,
    cover_shader: row.coverShader,
    video_url: row.videoUrl,
    youtube_url: row.youtubeUrl,
    tweet_url: row.tweetUrl,
    blend_url: row.blendUrl,
    blend_filename: row.blendFilename,
    card_url: row.cardUrl,
    nodevember_day: row.nodevemberDay,
    created_at: row.createdAt.toISOString(),
    seeded: row.seeded,
    visibility: row.visibility === "unlisted" ? "unlisted" : "public",
    tags: row.tags,
    search_text: row.searchText,
    edit_token_hash: row.editTokenHash,
    cover_file: row.coverFile,
    video_file: row.videoFile,
    blend_file: row.blendFile,
    user_id: row.userId,
  })
}

function toData(post: StoredPost) {
  return {
    slug: post.slug,
    title: post.title,
    authorName: post.author_name,
    authorSlug: post.author_slug,
    description: post.description,
    tree: post.tree === null ? Prisma.DbNull : (post.tree as unknown as Prisma.InputJsonValue),
    treeType: post.tree_type,
    blenderVersionString: post.blender_version_string,
    coverUrl: post.cover_url,
    videoUrl: post.video_url,
    blendUrl: post.blend_url,
    blendFilename: post.blend_filename,
    cardUrl: post.card_url,
    nodevemberDay: post.nodevember_day,
    createdAt: new Date(post.created_at),
    seeded: post.seeded,
    editTokenHash: post.edit_token_hash,
    coverFile: post.cover_file,
    videoFile: post.video_file,
    blendFile: post.blend_file,
    youtubeUrl: post.youtube_url,
    tweetUrl: post.tweet_url,
    coverShader: post.cover_shader,
    visibility: post.visibility,
    tags: post.tags,
    searchText: post.search_text,
    userId: post.user_id,
  }
}

export async function pgList(): Promise<StoredPost[]> {
  const prisma = await ensureSchema()
  const rows = await prisma.post.findMany({ orderBy: { createdAt: "desc" } })
  return rows.map(fromRow)
}

export async function pgGet(slug: string): Promise<StoredPost | undefined> {
  const prisma = await ensureSchema()
  const row = await prisma.post.findUnique({ where: { slug } })
  return row ? fromRow(row) : undefined
}

export async function pgSlugs(): Promise<string[]> {
  const prisma = await ensureSchema()
  const rows = await prisma.post.findMany({ select: { slug: true } })
  return rows.map((row) => row.slug)
}

export async function pgInsert(post: StoredPost): Promise<void> {
  const prisma = await ensureSchema()
  await prisma.post.create({ data: toData(post) })
}

export async function pgUpdate(post: StoredPost): Promise<void> {
  const prisma = await ensureSchema()
  const data = toData(post)
  const { slug, createdAt, ...rest } = data
  void createdAt
  await prisma.post.update({ where: { slug }, data: rest })
}

export async function pgDelete(slug: string): Promise<void> {
  const prisma = await ensureSchema()
  await prisma.post.delete({ where: { slug } })
}
