"use client"

import { Dialog } from "@/components/Dialog"
import { MarkdownField } from "@/components/MarkdownField"
import { TagPills } from "@/components/TagPills"
import { deletePost, updatePost } from "@/lib/managePost"
import { putBlob } from "@/lib/putBlob"
import type { Visibility } from "@/lib/posts"
import { btn, btnAccent, cn, errorBox, field } from "@/lib/ui"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

type EditablePost = {
  slug: string
  title: string
  description: string | null
  tags: string[]
  visibility: Visibility
  youtube_url: string | null
  tweet_url: string | null
  cover_shader: string | null
}

const label = "flex flex-col gap-2 text-[13px] font-medium text-fg"

async function attach(body: FormData, kind: "cover" | "video" | "blend", file: File | null) {
  if (!file || file.size === 0) {
    body.delete(kind)
    return
  }
  const token = await putBlob(kind, file)
  if (token) {
    body.delete(kind)
    body.set(`${kind}_blob`, token)
    body.set(`${kind}_filename`, file.name)
  } else {
    body.set(kind, file)
  }
}

export function PostOwnerActions({ post }: { post: EditablePost }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState(post.tags)
  const [visibility, setVisibility] = useState<Visibility>(post.visibility)

  async function onEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = new FormData(event.currentTarget)
    body.set("slug", post.slug)
    body.set("tags", tags.join(","))
    body.set("visibility", visibility)
    setBusy(true)
    setError(null)
    try {
      const cover = body.get("cover")
      const video = body.get("video")
      const blend = body.get("blend")
      await attach(body, "cover", cover instanceof File ? cover : null)
      await attach(body, "video", video instanceof File ? video : null)
      await attach(body, "blend", blend instanceof File ? blend : null)
      const result = await updatePost(body)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this post.")
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    setBusy(true)
    setError(null)
    try {
      const result = await deletePost(post.slug)
      if ("error" in result) {
        setError(result.error)
        return
      }
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this post.")
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => { setError(null); setEditing(true) }}>
          Edit
        </button>
        <button type="button" className={btn} onClick={() => { setError(null); setConfirming(true) }}>
          Delete
        </button>
      </div>
      {editing ? (
        <Dialog title="Edit this post" subtitle="The link stays the same." onClose={() => setEditing(false)} wide>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void onEdit(event)}>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 py-5">
              <label className={label}>
                Title
                <input className={field} name="title" required maxLength={120} defaultValue={post.title} />
              </label>
              <div className={label}>
                <label htmlFor="edit-description">
                  Note <span className="font-normal text-subtle">(optional, markdown)</span>
                </label>
                <MarkdownField id="edit-description" name="description" defaultValue={post.description ?? ""} />
              </div>
              <div className={label}>
                <span>
                  Tags <span className="font-normal text-subtle">(optional)</span>
                </span>
                <TagPills tags={tags} onChange={setTags} />
              </div>
              <label className={label}>
                Visibility
                <select
                  className={field}
                  name="visibility"
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value === "unlisted" ? "unlisted" : "public")}
                >
                  <option value="public">Public — listed in the gallery</option>
                  <option value="unlisted">Unlisted — only people with the link</option>
                </select>
              </label>
              <label className={label}>
                YouTube video <span className="font-normal text-subtle">(optional)</span>
                <input className={field} name="youtube_url" type="text" inputMode="url" maxLength={500} defaultValue={post.youtube_url ?? ""} placeholder="youtube.com/watch?v=…" />
              </label>
              <label className={label}>
                X / Instagram <span className="font-normal text-subtle">(optional)</span>
                <input className={field} name="tweet_url" type="text" inputMode="url" maxLength={500} defaultValue={post.tweet_url ?? ""} placeholder="x.com/you/status/…" />
              </label>
              <label className={label}>
                Cover shader <span className="font-normal text-subtle">(optional GLSL)</span>
                <textarea className={cn(field, "min-h-28 resize-y font-mono text-[12px] leading-relaxed")} name="cover_shader" spellCheck={false} defaultValue={post.cover_shader ?? ""} />
              </label>
              <label className={label}>
                Replace cover <span className="font-normal text-subtle">(optional)</span>
                <input className="text-[13px] font-normal text-muted" name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4" />
              </label>
              <label className={label}>
                Replace video <span className="font-normal text-subtle">(optional)</span>
                <input className="text-[13px] font-normal text-muted" name="video" type="file" accept="video/mp4" />
              </label>
              <label className={label}>
                Replace blend <span className="font-normal text-subtle">(optional)</span>
                <input className="text-[13px] font-normal text-muted" name="blend" type="file" accept=".blend" />
              </label>
              <label className={label}>
                Replace graph <span className="font-normal text-subtle">(optional)</span>
                <textarea
                  className={cn(field, "min-h-28 resize-y font-mono text-[12px] leading-relaxed")}
                  name="tree_text"
                  spellCheck={false}
                  placeholder="Paste a nodevault.tree payload. Leave this empty to keep the current graph."
                />
              </label>
              {error ? <p role="alert" className={cn(errorBox, "m-0")}>{error}</p> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
              <button type="button" className={btn} onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className={btnAccent} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}
      {confirming ? (
        <Dialog title="Delete this post?" subtitle="The link will stop working." onClose={() => setConfirming(false)}>
          <div className="flex flex-col gap-4 px-5 py-5">
            <p className="m-0 text-[14px] leading-relaxed text-muted">
              {post.title} is removed from the gallery. This cannot be undone.
            </p>
            {error ? <p role="alert" className={cn(errorBox, "m-0")}>{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setConfirming(false)} disabled={busy}>
                Keep it
              </button>
              <button type="button" className={btnAccent} onClick={() => void onDelete()} disabled={busy}>
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  )
}
