import { createHmac, timingSafeEqual } from "node:crypto"
import { env } from "@/env"
import { sniffBlend, sniffCover, sniffMp4 } from "@/lib/sniff"
import { BLEND_MAX, COVER_MAX, VIDEO_MAX } from "@/lib/sharing"

export const AZURE_STORED_PREFIX = "azure:"

export const UPLOAD_KINDS = ["cover", "video", "blend"] as const
export type UploadKind = (typeof UPLOAD_KINDS)[number]

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

type UploadRule = {
  dir: string
  maxBytes: number
  /** Content-Type the browser must send, keyed to the stored extension. */
  types: Readonly<Record<string, string>>
  tooBig: string
  wrongType: string
  missing: string
  invalid: string
  sniff: (head: Uint8Array) => { type: string; ext: string } | null
}

export const UPLOAD_RULES: Record<UploadKind, UploadRule> = {
  cover: {
    dir: "covers",
    maxBytes: COVER_MAX,
    types: {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
    },
    tooBig: "Cover is larger than 10 MB.",
    wrongType: "Cover must be jpeg, png, webp, or gif.",
    missing: "The cover upload was not found. Choose the image again.",
    invalid: "Cover upload is not valid. Choose the image again.",
    sniff: sniffCover,
  },
  video: {
    dir: "videos",
    maxBytes: VIDEO_MAX,
    types: { "video/mp4": "mp4" },
    tooBig: "Video is larger than 50 MB.",
    wrongType: "Video must be video/mp4.",
    missing: "The video upload was not found. Choose the file again.",
    invalid: "Video upload is not valid. Choose the file again.",
    sniff: (head) => (sniffMp4(head) ? { type: "video/mp4", ext: "mp4" } : null),
  },
  blend: {
    dir: "blends",
    maxBytes: BLEND_MAX,
    types: { "application/octet-stream": "blend" },
    tooBig: "Blend is larger than 100 MB.",
    wrongType: "Blend must be a .blend file.",
    missing: "The blend upload was not found. Choose the file again.",
    invalid: "Blend upload is not valid. Choose the file again.",
    sniff: (head) => (sniffBlend(head) ? { type: "application/octet-stream", ext: "blend" } : null),
  },
}

export function parseUploadKind(value: string): UploadKind | null {
  return (UPLOAD_KINDS as readonly string[]).includes(value) ? (value as UploadKind) : null
}

export function extensionFor(kind: UploadKind, contentType: string): string | null {
  return UPLOAD_RULES[kind].types[contentType] ?? null
}

export function isBlobName(kind: UploadKind, name: string): boolean {
  const rule = UPLOAD_RULES[kind]
  const exts = [...new Set(Object.values(rule.types))].join("|")
  return new RegExp(`^${rule.dir}/${UUID}\\.(${exts})$`).test(name)
}

export function isStoredBlobName(name: string): boolean {
  return UPLOAD_KINDS.some((kind) => isBlobName(kind, name))
}

/** Public blob URL. The browser loads this directly; the app does not proxy the bytes. */
export function azurePublicUrl(stored: string): string | null {
  if (!stored.startsWith(AZURE_STORED_PREFIX)) return null
  const account = env.AZURE_STORAGE_ACCOUNT
  const container = env.AZURE_STORAGE_CONTAINER
  if (!account || !container) return null
  const name = stored.slice(AZURE_STORED_PREFIX.length)
  if (!isStoredBlobName(name)) return null
  const path = name.split("/").map((part) => encodeURIComponent(part)).join("/")
  const base = env.AZURE_CDN_BASE_URL?.replace(/\/+$/, "")
  if (base) return `${base}/${container}/${path}`
  return `https://${account}.blob.core.windows.net/${container}/${path}`
}

/** Binds a blob to one kind so a publish request cannot reuse another upload. */
export function signBlob(kind: UploadKind, blobName: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(`${kind}\n${blobName}`).digest("base64url")
  return `${kind}~${blobName}~${sig}`
}

export function readBlobToken(token: string, secret: string): { kind: UploadKind; blobName: string } | null {
  const [kindRaw, blobName, sig] = token.split("~")
  if (!kindRaw || !blobName || !sig || token.split("~").length !== 3) return null
  const kind = parseUploadKind(kindRaw)
  if (!kind || !isBlobName(kind, blobName)) return null
  const expected = createHmac("sha256", secret).update(`${kind}\n${blobName}`).digest("base64url")
  const got = Buffer.from(sig)
  const want = Buffer.from(expected)
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  return { kind, blobName }
}

export function sniffUpload(kind: UploadKind, head: Uint8Array): { type: string; ext: string } | null {
  return UPLOAD_RULES[kind].sniff(head)
}

/** Original blend names are kept. Anything else falls back to graph.blend. */
export function blendFilename(raw: string | undefined): string {
  const base = (raw ?? "").split(/[/\\]/).pop() ?? ""
  const clean = base.replace(/[^\w.\- ]+/g, "").slice(0, 120)
  if (!clean.toLowerCase().endsWith(".blend")) return "graph.blend"
  return clean
}
