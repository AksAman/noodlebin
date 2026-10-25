"use server"

import { parseNoodleBinText } from "@/interchange"
import { sessionAuthor } from "@/lib/auth"
import { requireDurableStore } from "@/lib/publish"
import { isSharingError, parseUpdateForm } from "@/lib/sharing"
import { dataDir, deleteOwnedPost, updateOwnedPost } from "@/lib/store"
import { revalidatePath } from "next/cache"

function pathsFor(slug: string, handle: string) {
  revalidatePath(`/p/${slug}`)
  revalidatePath("/")
  revalidatePath(`/author/${handle}`)
}

export async function updatePost(form: FormData): Promise<{ ok: true } | { error: string }> {
  const storage = requireDurableStore()
  if (storage) return { error: storage.error }
  const session = await sessionAuthor()
  if (!session) return { error: "Sign in to edit this post." }
  const slug = String(form.get("slug") ?? "").trim()
  const parsed = await parseUpdateForm(form, parseNoodleBinText)
  if (isSharingError(parsed)) return { error: parsed.error }
  const result = await updateOwnedPost(slug, session.id, parsed, dataDir())
  if (isSharingError(result)) return { error: result.error }
  pathsFor(slug, session.handle)
  return { ok: true }
}

export async function deletePost(slug: string): Promise<{ ok: true } | { error: string }> {
  const storage = requireDurableStore()
  if (storage) return { error: storage.error }
  const session = await sessionAuthor()
  if (!session) return { error: "Sign in to delete this post." }
  const result = await deleteOwnedPost(slug, session.id, dataDir())
  if (isSharingError(result)) return { error: result.error }
  pathsFor(slug, session.handle)
  return { ok: true }
}
