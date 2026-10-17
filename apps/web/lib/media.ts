import { mkdir, readFile, writeFile } from "node:fs/promises"
import { env } from "@/env"
import { dirname, join, relative, resolve, sep } from "node:path"
import { put } from "@vercel/blob"

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isSafeSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 64 && SLUG_RE.test(slug)
}

export function usesBlob(): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN)
}

export function isVercelBlobUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      (url.hostname === "blob.vercel-storage.com" || url.hostname.endsWith(".blob.vercel-storage.com"))
    )
  } catch {
    return false
  }
}

function containedPath(root: string, rel: string): string {
  if (rel.includes("\0") || rel.startsWith("/") || rel.includes("..")) {
    throw new Error("Invalid media path.")
  }
  const full = resolve(root, rel)
  const prefix = resolve(root) + sep
  if (full !== resolve(root) && !full.startsWith(prefix)) {
    throw new Error("Invalid media path.")
  }
  if (relative(root, full).startsWith("..")) {
    throw new Error("Invalid media path.")
  }
  return full
}

export async function writeMedia(
  dir: string,
  rel: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  if (usesBlob()) {
    const result = await put(rel.replaceAll("\\", "/"), Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    })
    return result.url
  }
  const path = containedPath(dir, rel)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
  return rel
}

export async function readMediaBytes(
  dir: string,
  stored: string,
): Promise<Buffer | null> {
  if (stored.startsWith("https://")) {
    if (!isVercelBlobUrl(stored)) return null
    const res = await fetch(stored)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  }
  try {
    return await readFile(containedPath(dir, stored))
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === "ENOENT") return null
    throw err
  }
}

export function mediaUrl(slug: string, kind: "cover" | "video" | "blend", stored: string | null): string | null {
  if (!stored) return null
  if (stored.startsWith("https://")) return stored
  return `/api/media/${slug}/${kind}`
}
