export const SHARE_DRAFT_KEY = "nodevault.share-draft"

export type ShareDraft = {
  treeText: string
  title: string
  author: string
  description: string
  youtube_url: string
  tweet_url: string
  cover_shader: string
  visibility: "public" | "unlisted"
  tags: string
  coverName: string
  coverDataUrl: string
}

export function readShareDraft(raw: string | null): ShareDraft | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ShareDraft>
    if (!parsed.treeText) return null
    return {
      treeText: parsed.treeText,
      title: parsed.title ?? "",
      author: parsed.author ?? "",
      description: parsed.description ?? "",
      youtube_url: parsed.youtube_url ?? "",
      tweet_url: parsed.tweet_url ?? "",
      cover_shader: parsed.cover_shader ?? "",
      visibility: parsed.visibility === "unlisted" ? "unlisted" : "public",
      tags: parsed.tags ?? "",
      coverName: parsed.coverName ?? "",
      coverDataUrl: parsed.coverDataUrl ?? "",
    }
  } catch {
    return null
  }
}

type DraftStorage = Pick<Storage, "setItem" | "removeItem">

export function writeShareDraft(storage: DraftStorage, draft: ShareDraft): void {
  const json = JSON.stringify(draft)
  try {
    storage.setItem(SHARE_DRAFT_KEY, json)
  } catch {
    try {
      storage.setItem(SHARE_DRAFT_KEY, JSON.stringify({ ...draft, coverDataUrl: "", coverName: draft.coverName }))
    } catch {
      // Session storage can be unavailable or over quota.
    }
  }
}

export function clearShareDraft(storage: DraftStorage): void {
  try {
    storage.removeItem(SHARE_DRAFT_KEY)
  } catch {
    // Ignore unavailable storage.
  }
}
