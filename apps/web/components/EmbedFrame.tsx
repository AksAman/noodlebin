"use client"

import { NodeView } from "@/node-view"
import { serializeCopy, treeTypeLabel } from "@/lib/ingest"
import type { Catalog } from "@/catalog"
import type { VaultPost } from "@/lib/posts"
import { btnGhost, canvas, cn, treeDotClass } from "@/lib/ui"
import Link from "next/link"
import { useCallback, useState } from "react"

export function EmbedFrame({
  post,
  catalog,
  allowCopy,
}: {
  post: VaultPost
  catalog: Catalog | null
  allowCopy: boolean
}) {
  const payload = post.tree
  const root = payload?.trees.find((tree) => tree.is_root) ?? payload?.trees[0]
  const [copied, setCopied] = useState(false)
  const onCopy = useCallback(async () => {
    if (!payload) return
    await navigator.clipboard.writeText(serializeCopy(payload))
    setCopied(true)
  }, [payload])

  if (!payload || !root) {
    return <p className="p-6 text-muted">This graph is not available.</p>
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2 text-[13px] text-muted">
        <span className={cn(treeDotClass(post.tree_type), "size-2 rounded-full")} aria-hidden="true" />
        <span>{treeTypeLabel(post.tree_type)}</span>
        <span className="tabular-nums">Blender {post.blender_version_string}</span>
        <Link className="ml-auto text-accent-fg underline-offset-4 hover:underline" href={`/p/${post.slug}`} target="_blank">
          Open in NodeVault
        </Link>
        {allowCopy ? (
          <button type="button" className={btnGhost} onClick={() => void onCopy()}>
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>
      <div className={cn(canvas, "min-h-0")} data-theme="dark">
        <NodeView
          tree={root}
          trees={payload.trees}
          catalog={catalog}
          readOnly
          blenderVersion={payload.blender_version_string}
          showMinimap={false}
        />
      </div>
    </div>
  )
}
