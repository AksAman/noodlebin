import { mkdir, readFile, writeFile } from "node:fs/promises";
import { env } from "@/env";
import { dirname, join, resolve } from "node:path";
import type { NodeVaultPayload } from "@/interchange";
import { revalidateTag, unstable_cache } from "next/cache";
import {
  pgGet,
  pgInsert,
  pgList,
  pgSlugs,
  pgUpdate,
  usesPostgres,
} from "@/lib/db";
import { AZURE_STORED_PREFIX } from "@/lib/blobUpload";
import { isSafeSlug, mediaUrl, readMediaBytes, writeMedia } from "@/lib/media";
import { isMp4Name } from "@/lib/sniff";
import { buildSearchText } from "@/lib/search";
import {
  posts as seedPosts,
  type StoredPost,
  type VaultPost,
} from "@/lib/posts";
import {
  hashEditToken,
  newEditToken,
  uniqueSlug,
  slugify,
  tokenMatches,
  type NewPostInput,
  type PostLinks,
  type SharingError,
} from "@/lib/sharing";

export type { StoredPost };

type DiskShape = { posts: StoredPost[] };

const writeChain = new Map<string, Promise<unknown>>();

export function dataDir(): string {
  const fromEnv = env.NODEVAULT_DATA_DIR;
  if (fromEnv) return resolve(fromEnv);
  return join(process.cwd(), ".data");
}

function catalogPath(dir: string): string {
  return join(dir, "posts.json");
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
    cover_url: mediaUrl(post.slug, "cover", post.cover_file) ?? post.cover_url,
    cover_video: isMp4Name(post.cover_file) || isMp4Name(post.cover_url),
    cover_shader: post.cover_shader ?? null,
    video_url: mediaUrl(post.slug, "video", post.video_file) ?? post.video_url,
    youtube_url: post.youtube_url ?? null,
    tweet_url: post.tweet_url ?? null,
    blend_url: mediaUrl(post.slug, "blend", post.blend_file) ?? post.blend_url,
    blend_filename: post.blend_filename,
    card_url: post.card_url,
    nodevember_day: post.nodevember_day,
    created_at: post.created_at,
    seeded: post.seeded,
    visibility: post.visibility === "unlisted" ? "unlisted" : "public",
    tags: post.tags ?? [],
    search_text: post.search_text || buildSearchText(post),
  };
}

function normalizeDisk(post: StoredPost): StoredPost {
  const next: StoredPost = {
    ...post,
    author_slug: post.author_slug ?? null,
    cover_shader: post.cover_shader ?? null,
    youtube_url: post.youtube_url ?? null,
    tweet_url: post.tweet_url ?? null,
    visibility: post.visibility === "unlisted" ? "unlisted" : "public",
    tags: post.tags ?? [],
    user_id: post.user_id ?? null,
    search_text: post.search_text ?? "",
  };
  if (!next.search_text) next.search_text = buildSearchText(next);
  return next;
}

async function readDisk(dir: string): Promise<StoredPost[]> {
  try {
    const raw = await readFile(catalogPath(dir), "utf8");
    const parsed = JSON.parse(raw) as DiskShape;
    return (Array.isArray(parsed.posts) ? parsed.posts : []).map(normalizeDisk);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw err;
  }
}

async function writeDisk(dir: string, posts: StoredPost[]): Promise<void> {
  const path = catalogPath(dir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ posts }, null, 2)}\n`);
}

function withLock<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeChain.get(dir) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeChain.set(
    dir,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

export async function listStored(dir = dataDir()): Promise<StoredPost[]> {
  if (usesPostgres()) return pgList();
  return readDisk(dir);
}

const POSTS_TAG = "posts";

async function ensureAzureReads(posts: StoredPost[]): Promise<void> {
  const hasAzure = posts.some((post) =>
    [post.cover_file, post.video_file, post.blend_file].some((file) =>
      file?.startsWith(AZURE_STORED_PREFIX),
    ),
  );
  if (!hasAzure) return;
  const { ensurePublicReads } = await import("@/lib/azureBlob");
  await ensurePublicReads();
}

async function loadPublicPosts(dir: string): Promise<VaultPost[]> {
  const rows = await listStored(dir);
  await ensureAzureReads(rows);
  const stored = rows.map(publicOf);
  const bySlug = new Map<string, VaultPost>();
  for (const post of seedPosts) bySlug.set(post.slug, post);
  for (const post of stored) bySlug.set(post.slug, post);
  return [...bySlug.values()].filter((post) => post.visibility !== "unlisted");
}

const cachedPublicPosts = unstable_cache(loadPublicPosts, ["public-posts"], {
  tags: [POSTS_TAG],
  revalidate: env.NODEVAULT_POSTS_CACHE_TTL_SECONDS,
});

export async function allPublicPosts(dir = dataDir()): Promise<VaultPost[]> {
  try {
    return await cachedPublicPosts(dir);
  } catch (err) {
    // Bun tests call the route handlers outside a Next.js server, which has no data cache.
    if (
      err instanceof Error &&
      err.message.startsWith("Invariant: incrementalCache missing")
    ) {
      return loadPublicPosts(dir);
    }
    throw err;
  }
}

export function invalidatePostLists(): void {
  try {
    // Expire immediately. updateTag is server-action only, and these writes also run in route handlers.
    revalidateTag(POSTS_TAG, { expire: 0 });
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("static generation store missing")
    )
      return;
    throw err;
  }
}

export async function getPublicPost(
  slug: string,
  dir = dataDir(),
): Promise<VaultPost | undefined> {
  if (!isSafeSlug(slug)) return undefined;
  const stored = await getStoredPost(slug, dir);
  if (stored) {
    await ensureAzureReads([stored]);
    return publicOf(stored);
  }
  return seedPosts.find((p) => p.slug === slug);
}

export async function getStoredPost(
  slug: string,
  dir = dataDir(),
): Promise<StoredPost | undefined> {
  if (!isSafeSlug(slug)) return undefined;
  if (usesPostgres()) return pgGet(slug);
  return (await readDisk(dir)).find((p) => p.slug === slug);
}

async function takenSlugs(dir: string): Promise<Set<string>> {
  const slugs = usesPostgres()
    ? await pgSlugs()
    : (await readDisk(dir)).map((p) => p.slug);
  return new Set([...seedPosts.map((p) => p.slug), ...slugs]);
}

async function persistNew(dir: string, stored: StoredPost): Promise<void> {
  if (usesPostgres()) {
    await pgInsert(stored);
  } else {
    const posts = await readDisk(dir);
    posts.push(stored);
    await writeDisk(dir, posts);
  }
  invalidatePostLists();
}

async function persistPatch(dir: string, stored: StoredPost): Promise<void> {
  if (usesPostgres()) {
    await pgUpdate(stored);
  } else {
    const posts = await readDisk(dir);
    const index = posts.findIndex((p) => p.slug === stored.slug);
    if (index < 0) throw new Error("Post missing during patch.");
    posts[index] = stored;
    await writeDisk(dir, posts);
  }
  invalidatePostLists();
}

async function placeMedia(
  dir: string,
  rel: string,
  file: { bytes: Uint8Array; type: string; storedPath?: string },
): Promise<string> {
  return file.storedPath ?? writeMedia(dir, rel, file.bytes, file.type);
}

async function buildStored(
  input: NewPostInput,
  slug: string,
  token: string,
  dir: string,
): Promise<StoredPost> {
  const coverStored = await placeMedia(
    dir,
    join("files", slug, `cover.${input.files.cover.ext}`),
    input.files.cover,
  );

  let video_file: string | null = null;
  if (input.files.video) {
    video_file = await placeMedia(
      dir,
      join("files", slug, `video.${input.files.video.ext}`),
      input.files.video,
    );
  }

  let blend_file: string | null = null;
  let blend_filename: string | null = null;
  if (input.files.blend) {
    blend_file = await placeMedia(
      dir,
      join("files", slug, "graph.blend"),
      input.files.blend,
    );
    blend_filename = input.files.blend.filename ?? "graph.blend";
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
    visibility: input.visibility,
    tags: input.tags,
    search_text: "",
    edit_token_hash: hashEditToken(token),
    cover_file: coverStored,
    video_file,
    blend_file,
    user_id: input.user_id,
  };
  stored.search_text = buildSearchText(stored);
  return stored;
}

export async function createStoredPost(
  input: NewPostInput,
  dir = dataDir(),
): Promise<{ post: VaultPost; edit_token: string; url: string }> {
  const run = async () => {
    const slug = uniqueSlug(slugify(input.title), await takenSlugs(dir));
    const token = newEditToken();
    const stored = await buildStored(input, slug, token, dir);
    await persistNew(dir, stored);
    return { post: publicOf(stored), edit_token: token, url: `/p/${slug}` };
  };
  return usesPostgres() ? run() : withLock(dir, run);
}

export async function patchStoredPost(
  slug: string,
  token: string,
  patch: {
    tree?: NodeVaultPayload | null;
    cover?: NewPostInput["files"]["cover"];
    video?: NewPostInput["files"]["video"];
    blend?: NewPostInput["files"]["blend"];
  } & PostLinks,
  dir = dataDir(),
): Promise<{ post: VaultPost } | SharingError> {
  const run = async (): Promise<{ post: VaultPost } | SharingError> => {
    if (!isSafeSlug(slug))
      return { ok: false, status: 404, error: "Post not found." };
    const current = await getStoredPost(slug, dir);
    if (!current) {
      if (seedPosts.some((p) => p.slug === slug)) {
        return {
          ok: false,
          status: 403,
          error: "Fixture posts cannot be edited.",
        };
      }
      return { ok: false, status: 404, error: "Post not found." };
    }
    if (!tokenMatches(token, current.edit_token_hash)) {
      return { ok: false, status: 401, error: "Edit token does not match." };
    }

    if (patch.tree !== undefined) {
      current.tree = patch.tree;
      if (patch.tree) {
        current.tree_type = patch.tree.tree_type;
        current.blender_version_string = patch.tree.blender_version_string;
      }
    }
    if (patch.cover) {
      current.cover_file = await placeMedia(
        dir,
        join("files", slug, `cover.${patch.cover.ext}`),
        patch.cover,
      );
      current.cover_url = mediaUrl(slug, "cover", current.cover_file);
    }
    if (patch.video) {
      current.video_file = await placeMedia(
        dir,
        join("files", slug, `video.${patch.video.ext}`),
        patch.video,
      );
      current.video_url = mediaUrl(slug, "video", current.video_file);
    }
    if (patch.blend) {
      current.blend_file = await placeMedia(
        dir,
        join("files", slug, "graph.blend"),
        patch.blend,
      );
      current.blend_url = mediaUrl(slug, "blend", current.blend_file);
      current.blend_filename = patch.blend.filename ?? "graph.blend";
    }
    if (patch.youtube_url !== undefined)
      current.youtube_url = patch.youtube_url;
    if (patch.tweet_url !== undefined) current.tweet_url = patch.tweet_url;
    if (patch.cover_shader !== undefined)
      current.cover_shader = patch.cover_shader;
    current.search_text = buildSearchText(current);

    await persistPatch(dir, current);
    return { post: publicOf(current) };
  };
  return usesPostgres() ? run() : withLock(dir, run);
}

export async function readMediaFile(
  slug: string,
  kind: "cover" | "video" | "blend",
  dir = dataDir(),
): Promise<{ bytes: Buffer; type: string; filename: string } | null> {
  if (!isSafeSlug(slug)) return null;
  const post = await getStoredPost(slug, dir);
  if (!post) return null;
  const rel =
    kind === "cover"
      ? post.cover_file
      : kind === "video"
        ? post.video_file
        : post.blend_file;
  if (!rel) return null;
  const bytes = await readMediaBytes(dir, rel);
  if (!bytes) return null;
  if (kind === "cover") {
    const ext = rel.split(".").pop()?.split("?")[0];
    const type =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/png";
    return {
      bytes,
      type,
      filename: `cover.${ext && ext.length <= 4 ? ext : "png"}`,
    };
  }
  if (kind === "video")
    return { bytes, type: "video/mp4", filename: "video.mp4" };
  const filename = post.blend_filename ?? "graph.blend";
  const safeName =
    filename.replace(/[\r\n"]/g, "").slice(0, 120) || "graph.blend";
  return { bytes, type: "application/octet-stream", filename: safeName };
}
