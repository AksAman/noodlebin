import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { TREE_TYPES, type NoodleBinPayload, type TreeType } from "@/interchange"
import { parseSocialPost, parseYouTube } from "@/lib/embeds"
import { checkShaderSource } from "@/lib/shaderCover"
import { sniffBlend, sniffCover, sniffMp4 } from "@/lib/sniff"
import { env } from "@/env"
import { TAG_LIMIT, tagToken } from "@/lib/tags"

export const COVER_MAX = 10 * 1024 * 1024
export const VIDEO_MAX = 50 * 1024 * 1024
export const BLEND_MAX = 100 * 1024 * 1024
export const PAYLOAD_MAX = 5 * 1024 * 1024
/** Vercel Functions reject request bodies over 4.5 MB. */
export const VERCEL_BODY_MAX = 4 * 1024 * 1024

export function requestUploadMax(pidMax: number): number {
  return env.VERCEL ? Math.min(pidMax, VERCEL_BODY_MAX) : pidMax
}

export const COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"])

export type SharingError = {
  ok: false
  status: number
  error: string
}

export type StoredFile = {
  bytes: Uint8Array
  type: string
  ext: string
  filename?: string
  /** Set when the bytes are already in blob storage and must not be written again. */
  storedPath?: string
}

export type NewPostFiles = {
  cover: StoredFile
  video?: StoredFile
  blend?: StoredFile
}

export type NewPostInput = {
  title: string
  author_name: string
  author_slug: string | null
  description: string | null
  tree: NoodleBinPayload | null
  tree_type: TreeType
  blender_version_string: string
  nodevember_day: number | null
  youtube_url: string | null
  tweet_url: string | null
  cover_shader: string | null
  visibility: "public" | "unlisted"
  tags: string[]
  user_id: string | null
  files: NewPostFiles
}

export type PostLinks = { youtube_url?: string | null; tweet_url?: string | null; cover_shader?: string | null }

/** Reads the optional link fields. An absent field stays absent; an empty one means "no link". */
export function parseLinkFields(form: FormData): PostLinks | SharingError {
  const links: PostLinks = {}
  if (form.has("youtube_url")) {
    const raw = String(form.get("youtube_url") ?? "").trim()
    if (raw.length > 500) return { ok: false, status: 400, error: "YouTube link is too long." }
    const parsed = raw ? parseYouTube(raw) : null
    if (raw && !parsed) return { ok: false, status: 400, error: "YouTube link must point to a single video." }
    links.youtube_url = parsed?.url ?? null
  }
  if (form.has("tweet_url")) {
    const raw = String(form.get("tweet_url") ?? "").trim()
    if (raw.length > 500) return { ok: false, status: 400, error: "X or Instagram link is too long." }
    const parsed = raw ? parseSocialPost(raw) : null
    if (raw && !parsed) return { ok: false, status: 400, error: "X or Instagram link must point to a single post." }
    links.tweet_url = parsed?.url ?? null
  }
  if (form.has("cover_shader")) {
    const raw = String(form.get("cover_shader") ?? "")
    if (!raw.trim()) {
      links.cover_shader = null
    } else {
      const checked = checkShaderSource(raw)
      if (!checked.ok) return { ok: false, status: 400, error: checked.error }
      links.cover_shader = checked.source
    }
  }
  return links
}

export function parseTags(raw: string): string[] | SharingError {
  if (!raw.trim()) return []
  const tags = [...new Set(raw.split(",").map((tag) => tagToken(tag)).filter(Boolean))]
  if (tags.length > TAG_LIMIT) return { ok: false, status: 400, error: "Use at most 8 tags." }
  return tags
}

export function parseVisibility(raw: string): "public" | "unlisted" | SharingError {
  const value = raw.trim() || "public"
  if (value === "public" || value === "unlisted") return value
  return { ok: false, status: 400, error: "Visibility must be public or unlisted." }
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return slug || "post"
}

export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}-${randomBytes(3).toString("hex")}`
}

export function newEditToken(): string {
  return randomBytes(24).toString("base64url")
}

export function hashEditToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function tokenMatches(token: string, hash: string): boolean {
  const got = Buffer.from(hashEditToken(token), "hex")
  const want = Buffer.from(hash, "hex")
  if (got.length !== want.length) return false
  return timingSafeEqual(got, want)
}

export function isTreeType(value: string): value is TreeType {
  return (TREE_TYPES as readonly string[]).includes(value)
}

export function parseBlenderVersionString(value: string): string | SharingError {
  const trimmed = value.trim()
  if (!/^\d+\.\d+\.\d+$/.test(trimmed)) {
    return { ok: false, status: 400, error: "Blender version must look like 5.1.0." }
  }
  return trimmed
}

export function parseNodevemberDay(value: string | null): number | null | SharingError {
  if (value === null || value === "") return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 30) {
    return { ok: false, status: 400, error: "nodevember_day must be an integer 1 through 30." }
  }
  return n
}

type UploadKindName = "cover" | "video" | "blend"

/** A signed upload wins. Otherwise the file is read from the form, which is how tests and local disk mode publish. */
async function uploadedOrFile(
  form: FormData,
  kind: UploadKindName,
  read: (file: File | null) => Promise<StoredFile | SharingError | undefined>,
): Promise<StoredFile | SharingError | undefined> {
  const token = String(form.get(`${kind}_blob`) ?? "").trim()
  if (!token) {
    const field = form.get(kind)
    return read(field instanceof File ? field : null)
  }
  const { verifyUploaded } = await import("@/lib/azureBlob")
  const filename = String(form.get(`${kind}_filename`) ?? "").trim()
  return verifyUploaded(kind, token, filename || undefined)
}

export function isSharingError(value: unknown): value is SharingError {
  return typeof value === "object" && value !== null && "ok" in value && (value as SharingError).ok === false
}

export async function readCover(file: File | null): Promise<StoredFile | SharingError> {
  if (!file || file.size === 0) return { ok: false, status: 400, error: "A cover image is required." }
  const max = requestUploadMax(COVER_MAX)
  if (file.size > max) {
    return {
      ok: false,
      status: 400,
      error: env.VERCEL ? "Cover is larger than 4 MB (Vercel request limit)." : "Cover is larger than 10 MB.",
    }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const sniffed = sniffCover(bytes)
  if (!sniffed || !COVER_TYPES.has(sniffed.type)) {
    return { ok: false, status: 400, error: "Cover must be jpeg, png, webp, gif, or mp4." }
  }
  return { bytes, type: sniffed.type, ext: sniffed.ext }
}

export async function readVideo(file: File | null): Promise<StoredFile | SharingError | undefined> {
  if (!file || file.size === 0) return undefined
  const max = requestUploadMax(VIDEO_MAX)
  if (file.size > max) {
    return {
      ok: false,
      status: 400,
      error: env.VERCEL ? "Video is larger than 4 MB (Vercel request limit)." : "Video is larger than 50 MB.",
    }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!sniffMp4(bytes)) return { ok: false, status: 400, error: "Video must be video/mp4." }
  return { bytes, type: "video/mp4", ext: "mp4" }
}

export async function readBlend(file: File | null): Promise<StoredFile | SharingError | undefined> {
  if (!file || file.size === 0) return undefined
  const max = requestUploadMax(BLEND_MAX)
  if (file.size > max) {
    return {
      ok: false,
      status: 400,
      error: env.VERCEL ? "Blend is larger than 4 MB (Vercel request limit)." : "Blend is larger than 100 MB.",
    }
  }
  const filename = file.name || "graph.blend"
  if (!filename.toLowerCase().endsWith(".blend")) {
    return { ok: false, status: 400, error: "Blend must be a .blend file." }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!sniffBlend(bytes)) return { ok: false, status: 400, error: "Blend must be a .blend file." }
  return { bytes, type: "application/octet-stream", ext: "blend", filename }
}

export async function readPayload(
  file: File | null,
  textField: string | null,
  parse: (text: string) => NoodleBinPayload,
): Promise<NoodleBinPayload | null | SharingError> {
  let text = textField?.trim() ? textField : null
  const payloadMax = requestUploadMax(PAYLOAD_MAX)
  if (file && file.size > 0) {
    if (file.size > payloadMax) return { ok: false, status: 400, error: "Payload is larger than 5 MB." }
    text = await file.text()
  } else if (text && Buffer.byteLength(text, "utf8") > payloadMax) {
    return { ok: false, status: 400, error: "Payload is larger than 5 MB." }
  }
  if (!text) return null
  try {
    return parse(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payload is not a NoodleBin node tree."
    return { ok: false, status: 400, error: message }
  }
}

export async function parseCreateForm(
  form: FormData,
  parsePayload: (text: string) => NoodleBinPayload,
): Promise<NewPostInput | SharingError> {
  const title = String(form.get("title") ?? "").trim()
  const typedName = String(form.get("author_name") ?? "").trim()
  if (!title) return { ok: false, status: 400, error: "Title is required." }
  if (title.length > 120) return { ok: false, status: 400, error: "Title is too long." }
  if (typedName.length > 80) return { ok: false, status: 400, error: "Author name is too long." }
  const author_name = typedName || "Anonymous"
  const author_slug = typedName ? slugify(typedName) : null

  const visibility = parseVisibility(String(form.get("visibility") ?? ""))
  if (typeof visibility !== "string") return visibility
  const tags = parseTags(String(form.get("tags") ?? ""))
  if (!Array.isArray(tags)) return tags
  const descriptionRaw = String(form.get("description") ?? "").trim()
  if (descriptionRaw.length > 4000) return { ok: false, status: 400, error: "Description is too long." }
  const description = descriptionRaw ? descriptionRaw : null

  const cover = await uploadedOrFile(form, "cover", readCover)
  if (!cover || isSharingError(cover)) return cover ?? { ok: false, status: 400, error: "A cover image is required." }

  const video = await uploadedOrFile(form, "video", readVideo)
  if (isSharingError(video)) return video

  const blend = await uploadedOrFile(form, "blend", readBlend)
  if (isSharingError(blend)) return blend

  const treeField = form.get("tree")
  const treeFile = treeField instanceof File ? treeField : null
  const treeText = treeFile ? "" : String(form.get("tree_text") ?? "")
  const tree = await readPayload(treeFile, treeText || null, parsePayload)
  if (isSharingError(tree)) return tree

  const day = parseNodevemberDay(String(form.get("nodevember_day") ?? "") || null)
  if (isSharingError(day)) return day

  const links = parseLinkFields(form)
  if (isSharingError(links)) return links

  let tree_type: TreeType
  let blender_version_string: string
  if (tree) {
    tree_type = tree.tree_type
    blender_version_string = tree.blender_version_string
  } else {
    const typed = String(form.get("tree_type") ?? "").trim()
    if (!isTreeType(typed)) {
      return {
        ok: false,
        status: 400,
        error: "tree_type must be ShaderNodeTree, GeometryNodeTree, or CompositorNodeTree.",
      }
    }
    tree_type = typed
    const version = parseBlenderVersionString(String(form.get("blender_version_string") ?? ""))
    if (typeof version !== "string") return version
    blender_version_string = version
  }

  const files: NewPostFiles = { cover }
  if (video) files.video = video
  if (blend) files.blend = blend

  return {
    title,
    author_name,
    author_slug,
    description,
    tree,
    tree_type,
    blender_version_string,
    nodevember_day: day,
    youtube_url: links.youtube_url ?? null,
    tweet_url: links.tweet_url ?? null,
    cover_shader: links.cover_shader ?? null,
    visibility,
    tags,
    user_id: null,
    files,
  }
}

export type OwnedPostUpdate = {
  title: string
  description: string | null
  visibility: "public" | "unlisted"
  tags: string[]
  youtube_url?: string | null
  tweet_url?: string | null
  cover_shader?: string | null
  /** Set only when the form includes a replacement tree. Absent keeps the current graph. */
  tree?: NoodleBinPayload
  files: {
    cover?: StoredFile
    video?: StoredFile
    blend?: StoredFile
  }
}

/** Edit form for a post the signed-in author already owns. Cover and tree are optional. */
export async function parseUpdateForm(
  form: FormData,
  parsePayload: (text: string) => NoodleBinPayload,
): Promise<OwnedPostUpdate | SharingError> {
  const title = String(form.get("title") ?? "").trim()
  if (!title) return { ok: false, status: 400, error: "Title is required." }
  if (title.length > 120) return { ok: false, status: 400, error: "Title is too long." }

  const visibility = parseVisibility(String(form.get("visibility") ?? ""))
  if (typeof visibility !== "string") return visibility
  const tags = parseTags(String(form.get("tags") ?? ""))
  if (!Array.isArray(tags)) return tags
  const descriptionRaw = String(form.get("description") ?? "").trim()
  if (descriptionRaw.length > 4000) return { ok: false, status: 400, error: "Description is too long." }

  const links = parseLinkFields(form)
  if (isSharingError(links)) return links

  const cover = await optionalUpload(form, "cover", readCover)
  if (isSharingError(cover)) return cover
  const video = await optionalUpload(form, "video", readVideo)
  if (isSharingError(video)) return video
  const blend = await optionalUpload(form, "blend", readBlend)
  if (isSharingError(blend)) return blend

  const treeField = form.get("tree")
  const treeFile = treeField instanceof File && treeField.size > 0 ? treeField : null
  const treeText = treeFile ? "" : String(form.get("tree_text") ?? "")
  let tree: NoodleBinPayload | undefined
  if (treeFile || treeText.trim()) {
    const parsed = await readPayload(treeFile, treeText || null, parsePayload)
    if (isSharingError(parsed)) return parsed
    if (parsed) tree = parsed
  }

  const files: OwnedPostUpdate["files"] = {}
  if (cover) files.cover = cover
  if (video) files.video = video
  if (blend) files.blend = blend

  return {
    title,
    description: descriptionRaw ? descriptionRaw : null,
    visibility,
    tags,
    ...links,
    ...(tree ? { tree } : {}),
    files,
  }
}

async function optionalUpload(
  form: FormData,
  kind: UploadKindName,
  read: (file: File | null) => Promise<StoredFile | SharingError | undefined>,
): Promise<StoredFile | SharingError | undefined> {
  const token = String(form.get(`${kind}_blob`) ?? "").trim()
  const field = form.get(kind)
  const file = field instanceof File && field.size > 0 ? field : null
  if (!token && !file) return undefined
  return uploadedOrFile(form, kind, async (incoming) => {
    if (!incoming || incoming.size === 0) return undefined
    return read(incoming)
  })
}

export function editTokenFromRequest(request: Request, form: FormData | null): string | null {
  const header = request.headers.get("authorization")
  if (header?.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim()
    if (token) return token
  }
  const named = request.headers.get("x-edit-token")
  if (named?.trim()) return named.trim()
  if (form) {
    const field = String(form.get("edit_token") ?? "").trim()
    if (field) return field
  }
  return null
}
