import { neon, type NeonQueryFunction } from "@neondatabase/serverless"
import type { NodeVaultPayload, TreeType } from "@/interchange"
import type { StoredPost } from "@/lib/posts"

type Sql = NeonQueryFunction<false, false>

let sql: Sql | null = null
let migrated: Promise<void> | null = null

export function usesPostgres(): boolean {
  return Boolean(process.env["DATABASE_URL"]) && !process.env["NODEVAULT_DATA_DIR"]
}

function getSql(): Sql {
  const url = process.env["DATABASE_URL"]
  if (!url) throw new Error("DATABASE_URL is not set.")
  if (!sql) sql = neon(url)
  return sql
}

export async function ensureSchema(): Promise<Sql> {
  const client = getSql()
  if (!migrated) {
    migrated = (async () => {
      await client`
        CREATE TABLE IF NOT EXISTS posts (
          slug TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          author_name TEXT NOT NULL,
          author_slug TEXT NOT NULL,
          description TEXT,
          tree JSONB,
          tree_type TEXT NOT NULL CHECK (tree_type IN ('ShaderNodeTree', 'GeometryNodeTree', 'CompositorNodeTree')),
          blender_version_string TEXT NOT NULL,
          cover_url TEXT,
          video_url TEXT,
          blend_url TEXT,
          blend_filename TEXT,
          card_url TEXT,
          nodevember_day INTEGER CHECK (nodevember_day IS NULL OR (nodevember_day >= 1 AND nodevember_day <= 30)),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          seeded BOOLEAN NOT NULL DEFAULT false,
          edit_token_hash TEXT NOT NULL,
          cover_file TEXT,
          video_file TEXT,
          blend_file TEXT
        )
      `
      await client`ALTER TABLE posts ADD COLUMN IF NOT EXISTS youtube_url TEXT`
      await client`ALTER TABLE posts ADD COLUMN IF NOT EXISTS tweet_url TEXT`
      await client`CREATE INDEX IF NOT EXISTS posts_author_slug_idx ON posts (author_slug)`
      await client`CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC)`
    })()
  }
  await migrated
  return client
}

type PostRow = {
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
  youtube_url: string | null
  tweet_url: string | null
  blend_url: string | null
  blend_filename: string | null
  card_url: string | null
  nodevember_day: number | null
  created_at: string | Date
  seeded: boolean
  edit_token_hash: string
  cover_file: string | null
  video_file: string | null
  blend_file: string | null
}

export function rowToStored(row: PostRow): StoredPost {
  return {
    slug: row.slug,
    title: row.title,
    author_name: row.author_name,
    author_slug: row.author_slug,
    description: row.description,
    tree: row.tree,
    tree_type: row.tree_type,
    blender_version_string: row.blender_version_string,
    cover_url: row.cover_url,
    video_url: row.video_url,
    youtube_url: row.youtube_url ?? null,
    tweet_url: row.tweet_url ?? null,
    blend_url: row.blend_url,
    blend_filename: row.blend_filename,
    card_url: row.card_url,
    nodevember_day: row.nodevember_day,
    created_at: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
    seeded: row.seeded,
    edit_token_hash: row.edit_token_hash,
    cover_file: row.cover_file,
    video_file: row.video_file,
    blend_file: row.blend_file,
  }
}

export async function pgList(): Promise<StoredPost[]> {
  const client = await ensureSchema()
  const rows = (await client`SELECT * FROM posts ORDER BY created_at DESC`) as PostRow[]
  return rows.map(rowToStored)
}

export async function pgGet(slug: string): Promise<StoredPost | undefined> {
  const client = await ensureSchema()
  const rows = (await client`SELECT * FROM posts WHERE slug = ${slug} LIMIT 1`) as PostRow[]
  const row = rows[0]
  return row ? rowToStored(row) : undefined
}

export async function pgSlugs(): Promise<string[]> {
  const client = await ensureSchema()
  const rows = (await client`SELECT slug FROM posts`) as { slug: string }[]
  return rows.map((r) => r.slug)
}

export async function pgInsert(post: StoredPost): Promise<void> {
  const client = await ensureSchema()
  await client`
    INSERT INTO posts (
      slug, title, author_name, author_slug, description, tree, tree_type,
      blender_version_string, cover_url, video_url, blend_url, blend_filename,
      card_url, nodevember_day, created_at, seeded, edit_token_hash,
      cover_file, video_file, blend_file, youtube_url, tweet_url
    ) VALUES (
      ${post.slug}, ${post.title}, ${post.author_name}, ${post.author_slug},
      ${post.description}, ${post.tree === null ? null : JSON.stringify(post.tree)}, ${post.tree_type},
      ${post.blender_version_string}, ${post.cover_url}, ${post.video_url},
      ${post.blend_url}, ${post.blend_filename}, ${post.card_url},
      ${post.nodevember_day}, ${post.created_at}, ${post.seeded},
      ${post.edit_token_hash}, ${post.cover_file}, ${post.video_file}, ${post.blend_file},
      ${post.youtube_url}, ${post.tweet_url}
    )
  `
}

export async function pgUpdate(post: StoredPost): Promise<void> {
  const client = await ensureSchema()
  await client`
    UPDATE posts SET
      title = ${post.title},
      author_name = ${post.author_name},
      author_slug = ${post.author_slug},
      description = ${post.description},
      tree = ${post.tree === null ? null : JSON.stringify(post.tree)},
      tree_type = ${post.tree_type},
      blender_version_string = ${post.blender_version_string},
      cover_url = ${post.cover_url},
      video_url = ${post.video_url},
      blend_url = ${post.blend_url},
      blend_filename = ${post.blend_filename},
      card_url = ${post.card_url},
      nodevember_day = ${post.nodevember_day},
      edit_token_hash = ${post.edit_token_hash},
      cover_file = ${post.cover_file},
      video_file = ${post.video_file},
      blend_file = ${post.blend_file},
      youtube_url = ${post.youtube_url},
      tweet_url = ${post.tweet_url}
    WHERE slug = ${post.slug}
  `
}
