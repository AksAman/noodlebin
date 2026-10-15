"use client"

import { serializeCopy, treeTypeLabel } from "@/lib/ingest"
import type { NodeVaultPayload } from "@/interchange"
import { btn, btnAccent, field } from "@/lib/ui"
import { useEffect, useState } from "react"

const AUTHOR_KEY = "nodevault.author_name"

type Created = { url: string }

const sheet =
  "relative z-[1] flex h-full w-full max-w-[380px] flex-col gap-3.5 overflow-auto border-l border-[#3a3a3a] bg-[#1c1c1c] px-5 pb-7 pt-5 shadow-[-16px_0_40px_rgb(0_0_0_/_35%)]"

export function ShareSheet({
  payload,
  onClose,
}: {
  payload: NodeVaultPayload
  onClose: (publishedUrl?: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)
  const [author, setAuthor] = useState("")
  const [coverName, setCoverName] = useState<string | null>(null)

  const count = payload.origin.node_count
  const typeLabel = treeTypeLabel(payload.tree_type)
  const defaultTitle = `${count} ${typeLabel.toLowerCase()} node${count === 1 ? "" : "s"}`

  useEffect(() => {
    try {
      setAuthor(localStorage.getItem(AUTHOR_KEY) ?? "")
    } catch {
      setAuthor("")
    }
  }, [])

  if (created) {
    return (
      <div className={sheet} role="dialog" aria-labelledby="share-title">
        <div className="flex items-start justify-between gap-3">
          <h2 id="share-title" className="text-[1.15rem] text-[#eee]">
            It’s live
          </h2>
          <button type="button" className="cursor-pointer border-0 bg-transparent text-[22px] leading-none text-[#888]" onClick={() => onClose(created.url)} aria-label="Close">
            ×
          </button>
        </div>
        <p className="text-[13px] leading-snug text-[#9a9a9a]">Anyone with the link can open the graph and copy it into Blender.</p>
        <a className="break-all text-[13px] text-[#e8c4a0]" href={created.url}>
          {created.url}
        </a>
        <a className={btnAccent} href={created.url}>
          Open post
        </a>
      </div>
    )
  }

  return (
    <form
      className={sheet}
      role="dialog"
      aria-labelledby="share-title"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const name = String(new FormData(form).get("author_name") ?? "").trim()
        if (name) {
          try {
            localStorage.setItem(AUTHOR_KEY, name)
          } catch {
            /* ignore */
          }
        }
        const body = new FormData(form)
        body.set("tree_text", serializeCopy(payload))
        setBusy(true)
        setError(null)
        void fetch("/api/posts", { method: "POST", body })
          .then(async (res) => {
            const json = (await res.json()) as { error?: string; url?: string }
            if (!res.ok || !json.url) {
              setError(json.error ?? "Could not publish.")
              return
            }
            setCreated({ url: json.url })
          })
          .catch(() => setError("Could not publish."))
          .finally(() => setBusy(false))
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="share-title" className="text-[1.15rem] text-[#eee]">
          Share this graph
        </h2>
        <button type="button" className="cursor-pointer border-0 bg-transparent text-[22px] leading-none text-[#888]" onClick={() => onClose()} aria-label="Close">
          ×
        </button>
      </div>
      <p className="text-[13px] leading-snug text-[#9a9a9a]">
        Give it a name and a still. Tree type and Blender version come from what you pasted.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-[#3f3f3f] bg-[#2a2a2a] px-2.5 py-1 text-xs text-[#cfcfcf]">{typeLabel}</span>
        <span className="rounded-full border border-[#3f3f3f] bg-[#2a2a2a] px-2.5 py-1 text-xs text-[#cfcfcf]">{payload.blender_version_string}</span>
        <span className="rounded-full border border-[#3f3f3f] bg-[#2a2a2a] px-2.5 py-1 text-xs text-[#cfcfcf]">
          {count} node{count === 1 ? "" : "s"}
        </span>
      </div>
      <label className="flex flex-col gap-1.5 text-xs text-[#b0b0b0]">
        Title
        <input className={field} name="title" required maxLength={120} defaultValue={defaultTitle} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-[#b0b0b0]">
        Your name
        <input className={field} name="author_name" required maxLength={80} value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-[#b0b0b0]">
        Note <span className="font-normal text-[#777]">optional</span>
        <textarea className={`${field} resize-y`} name="description" rows={2} placeholder="What should someone know before they paste this?" />
      </label>
      <label className="relative flex flex-col gap-1.5 text-xs text-[#b0b0b0]">
        Cover still
        <span className="block cursor-pointer rounded-md border border-dashed border-[#555] bg-[#141414] px-2.5 py-3.5 text-center text-[#ccc]">
          {coverName ?? "Choose an image"}
        </span>
        <input
          className="absolute h-px w-px opacity-0"
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          required
          onChange={(event) => setCoverName(event.target.files?.[0]?.name ?? null)}
        />
      </label>
      {error ? <p className="text-[13px] text-[#e8a0a0]">{error}</p> : null}
      <div className="mt-auto flex justify-end gap-2">
        <button type="button" className={btn} onClick={() => onClose()}>
          Not now
        </button>
        <button type="submit" className={btnAccent} disabled={busy}>
          {busy ? "Publishing…" : "Publish"}
        </button>
      </div>
    </form>
  )
}
