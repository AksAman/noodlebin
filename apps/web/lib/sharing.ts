import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { TREE_TYPES, type NodeVaultPayload, type TreeType } from "@/interchange"

export const COVER_MAX = 10 * 1024 * 1024
export const VIDEO_MAX = 50 * 1024 * 1024
export const BLEND_MAX = 100 * 1024 * 1024
export const PAYLOAD_MAX = 5 * 1024 * 1024

export const COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

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
}

export type NewPostFiles = {
  cover: StoredFile
  video?: StoredFile
  blend?: StoredFile
}

export type NewPostInput = {
  title: string
  author_name: string
  author_slug: string
  description: string | null
  tree: NodeVaultPayload | null
  tree_type: TreeType
  blender_version_string: string
  nodevember_day: number | null
  files: NewPostFiles
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

export function isSharingError(value: unknown): value is SharingError {
  return typeof value === "object" && value !== null && "ok" in value && (value as SharingError).ok === false
}

function coverExt(type: string): string | null {
  if (type === "image/jpeg") return "jpg"
  if (type === "image/png") return "png"
  if (type === "image/webp") return "webp"
  if (type === "image/gif") return "gif"
  return null
}

export async function readCover(file: File | null): Promise<StoredFile | SharingError> {
  if (!file || file.size === 0) return { ok: false, status: 400, error: "A cover image is required." }
  if (file.size > COVER_MAX) return { ok: false, status: 400, error: "Cover is larger than 10 MB." }
  const type = file.type || "application/octet-stream"
  const ext = coverExt(type)
  if (!ext || !COVER_TYPES.has(type)) {
    return { ok: false, status: 400, error: "Cover must be jpeg, png, webp, or gif." }
  }
  return { bytes: new Uint8Array(await file.arrayBuffer()), type, ext }
}

export async function readVideo(file: File | null): Promise<StoredFile | SharingError | undefined> {
  if (!file || file.size === 0) return undefined
  if (file.size > VIDEO_MAX) return { ok: false, status: 400, error: "Video is larger than 50 MB." }
  if (file.type !== "video/mp4") return { ok: false, status: 400, error: "Video must be video/mp4." }
  return { bytes: new Uint8Array(await file.arrayBuffer()), type: "video/mp4", ext: "mp4" }
}

export async function readBlend(file: File | null): Promise<StoredFile | SharingError | undefined> {
  if (!file || file.size === 0) return undefined
  if (file.size > BLEND_MAX) return { ok: false, status: 400, error: "Blend is larger than 100 MB." }
  const filename = file.name || "graph.blend"
  if (!filename.toLowerCase().endsWith(".blend")) {
    return { ok: false, status: 400, error: "Blend must be a .blend file." }
  }
  return { bytes: new Uint8Array(await file.arrayBuffer()), type: "application/octet-stream", ext: "blend", filename }
}

export async function readPayload(
  file: File | null,
  textField: string | null,
  parse: (text: string) => NodeVaultPayload,
): Promise<NodeVaultPayload | null | SharingError> {
  let text = textField?.trim() ? textField : null
  if (file && file.size > 0) {
    if (file.size > PAYLOAD_MAX) return { ok: false, status: 400, error: "Payload is larger than 5 MB." }
    text = await file.text()
  } else if (text && Buffer.byteLength(text, "utf8") > PAYLOAD_MAX) {
    return { ok: false, status: 400, error: "Payload is larger than 5 MB." }
  }
  if (!text) return null
  try {
    return parse(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payload is not a NodeVault node tree."
    return { ok: false, status: 400, error: message }
  }
}

export async function parseCreateForm(
  form: FormData,
  parsePayload: (text: string) => NodeVaultPayload,
): Promise<NewPostInput | SharingError> {
  const title = String(form.get("title") ?? "").trim()
  const author_name = String(form.get("author_name") ?? "").trim()
  if (!title) return { ok: false, status: 400, error: "Title is required." }
  if (!author_name) return { ok: false, status: 400, error: "Author name is required." }

  const author_slug = slugify(String(form.get("author_slug") ?? "").trim() || author_name)
  const descriptionRaw = String(form.get("description") ?? "").trim()
  const description = descriptionRaw ? descriptionRaw : null

  const coverField = form.get("cover")
  const cover = await readCover(coverField instanceof File ? coverField : null)
  if (isSharingError(cover)) return cover

  const videoField = form.get("video")
  const video = await readVideo(videoField instanceof File ? videoField : null)
  if (isSharingError(video)) return video

  const blendField = form.get("blend")
  const blend = await readBlend(blendField instanceof File ? blendField : null)
  if (isSharingError(blend)) return blend

  const treeField = form.get("tree")
  const treeFile = treeField instanceof File ? treeField : null
  const treeText = treeFile ? "" : String(form.get("tree_text") ?? "")
  const tree = await readPayload(treeFile, treeText || null, parsePayload)
  if (isSharingError(tree)) return tree

  const day = parseNodevemberDay(String(form.get("nodevember_day") ?? "") || null)
  if (isSharingError(day)) return day

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
    files,
  }
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
