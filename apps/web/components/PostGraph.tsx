"use client"

import { NodeView } from "@/node-view"
import { serializeCopy, treeTypeLabel } from "@/lib/ingest"
import type { Catalog } from "@/catalog"
import type { VaultPost } from "@/lib/posts"
import type { NodeVaultPayload } from "@/interchange"
import { btn, canvas, cn, fallback, notice as noticeClass, shell } from "@/lib/ui"
import Link from "next/link"
import { useCallback, useRef, useState } from "react"

export function PostGraph({
  post,
  payload,
  catalog,
  notice,
}: {
  post: VaultPost
  payload: NodeVaultPayload
  catalog: Catalog | null
  notice: string | null
}) {
  const [copied, setCopied] = useState(false)
  const [fallbackText, setFallbackText] = useState<string | null>(null)
  const [showMinimap, setShowMinimap] = useState(true)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const root = payload.trees.find((t) => t.is_root) ?? payload.trees[0]
  const groups = payload.trees.length - 1
  const day = post.nodevember_day ? ` · Day ${post.nodevember_day}` : ""

  const onCopy = useCallback(async () => {
    const text = serializeCopy(payload)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setFallbackText(null)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setFallbackText(text)
    }
  }, [payload])

  if (!root) return null

  return (
    <div className={cn(shell, "min-h-0 overflow-hidden")}>
      {post.video_url ? (
        <video
          className="block max-h-40 w-full shrink-0 border-b border-[#2a2a2a] object-cover"
          controls
          poster={post.cover_url ?? undefined}
          src={post.video_url}
        />
      ) : post.cover_url ? (
        <img className="block max-h-40 w-full shrink-0 border-b border-[#2a2a2a] object-cover" src={post.cover_url} alt="" />
      ) : null}
      <header className="flex shrink-0 items-start justify-between gap-x-6 gap-y-4 border-b border-[#2a2a2a] px-5 py-3.5">
        <div className="min-w-0">
          <h1 className="text-[1.15rem] font-semibold tracking-tight text-[#ececec]">{post.title}</h1>
          <p className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-nv-muted">
            <Link className="text-[#c9c9c9] no-underline hover:text-[#eee]" href={`/@${post.author_slug}`}>
              @{post.author_slug}
            </Link>
            <span>
              {treeTypeLabel(post.tree_type)} · {post.blender_version_string}
              {day}
            </span>
            <span>
              {payload.origin.node_count} node{payload.origin.node_count === 1 ? "" : "s"}
              {groups > 0 ? ` · ${groups} group${groups === 1 ? "" : "s"}` : ""}
            </span>
          </p>
          {post.description ? <p className="mt-2 max-w-xl text-[13px] leading-snug text-[#9c9c9c]">{post.description}</p> : null}
          {post.blend_url ? (
            <p className="mt-2 max-w-xl text-[13px] leading-snug">
              <a className="text-[#c9c9c9]" href={post.blend_url}>
                Download {post.blend_filename ?? "graph.blend"}
              </a>
            </p>
          ) : null}
          {notice ? <p className={cn(noticeClass, "mt-2 inline-block")}>{notice}</p> : null}
        </div>
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={() => setShowMinimap((v) => !v)}>
            {showMinimap ? "Hide map" : "Show map"}
          </button>
          <button type="button" className={btn} onClick={() => void onCopy()}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </header>
      <div className={canvas}>
        <NodeView
          tree={root}
          trees={payload.trees}
          catalog={catalog}
          readOnly
          onCopy={() => void onCopy()}
          blenderVersion={payload.blender_version_string}
          showMinimap={showMinimap}
        />
        {fallbackText ? (
          <div className={fallback}>
            <p>Copy this text, then paste it in Blender.</p>
            <textarea
              className="flex-1 border border-[#444] bg-[#111] font-mono text-[11px] text-[#ddd]"
              readOnly
              value={fallbackText}
              autoFocus
              onFocus={(e) => e.target.select()}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
