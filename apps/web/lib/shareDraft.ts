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
    }
  } catch {
    return null
  }
}
