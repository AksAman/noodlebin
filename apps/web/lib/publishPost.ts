"use server"

import { parseNodeVaultText } from "@/interchange"
import { sessionAuthor } from "@/lib/auth"
import { requireDurableStore } from "@/lib/publish"
import { isSharingError, parseCreateForm } from "@/lib/sharing"
import { createStoredPost, dataDir } from "@/lib/store"

export async function publishPost(form: FormData): Promise<{ url: string } | { error: string }> {
  const storage = requireDurableStore()
  if (storage) return { error: storage.error }
  const parsed = await parseCreateForm(form, parseNodeVaultText)
  if (isSharingError(parsed)) return { error: parsed.error }
  const session = await sessionAuthor()
  if (session) {
    parsed.author_name = session.name
    parsed.author_slug = session.handle
    parsed.user_id = session.id
  }
  const created = await createStoredPost(parsed, dataDir())
  return { url: created.url }
}
