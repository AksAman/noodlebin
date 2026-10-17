import { timingSafeEqual } from "node:crypto"
import { env } from "@/env"
import { usesPostgres } from "@/lib/db"
import { hashEditToken, type SharingError } from "@/lib/sharing"

export function publishTokenFromRequest(request: Request, form: FormData | null): string | null {
  const header = request.headers.get("x-publish-token")
  if (header?.trim()) return header.trim()
  if (form) {
    const field = String(form.get("publish_token") ?? "").trim()
    if (field) return field
  }
  return null
}

export function requirePublishAccess(request: Request, form: FormData | null): SharingError | null {
  const expected = env.PUBLISH_SECRET
  if (!expected) {
    if (env.VERCEL) {
      return { ok: false, status: 503, error: "Publishing is not configured." }
    }
    return null
  }
  const got = publishTokenFromRequest(request, form)
  if (!got) return { ok: false, status: 401, error: "Publish token required." }
  const a = Buffer.from(hashEditToken(got), "hex")
  const b = Buffer.from(hashEditToken(expected), "hex")
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Publish token does not match." }
  }
  return null
}

export function requireDurableStore(): SharingError | null {
  if (env.VERCEL && !usesPostgres()) {
    return { ok: false, status: 503, error: "Storage is not configured." }
  }
  return null
}
