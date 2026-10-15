"use client"

import { NodeView } from "@/node-view"
import { serializeCopy } from "@/lib/ingest"
import type { Catalog } from "@/catalog"
import type { NodeVaultPayload } from "@/interchange"
import { useCallback, useRef, useState } from "react"

export function PostGraph({
  payload,
  catalog,
  notice,
}: {
  payload: NodeVaultPayload
  catalog: Catalog | null
  notice: string | null
}) {
  const [copied, setCopied] = useState(false)
  const [fallback, setFallback] = useState<string | null>(null)
  const [showMinimap, setShowMinimap] = useState(true)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const root = payload.trees.find((t) => t.is_root) ?? payload.trees[0]
  const groups = payload.trees.length - 1

  const onCopy = useCallback(async () => {
    const text = serializeCopy(payload)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setFallback(null)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setFallback(text)
    }
  }, [payload])

  if (!root) return null

  return (
    <>
      <div className="topbar-actions" style={{ padding: "0 20px 16px" }}>
        <button type="button" onClick={() => setShowMinimap((v) => !v)}>
          {showMinimap ? "Hide map" : "Show map"}
        </button>
        <button type="button" onClick={() => void onCopy()}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="canvas-wrap post-graph">
        <div className="topbar">
          <div className="topbar-meta">
            <span>
              {payload.origin.node_count} node{payload.origin.node_count === 1 ? "" : "s"}
              {groups > 0 ? ` · ${groups} group${groups === 1 ? "" : "s"}` : ""}
            </span>
            {notice ? <span className="notice">{notice}</span> : null}
          </div>
        </div>
        <NodeView
          tree={root}
          trees={payload.trees}
          catalog={catalog}
          readOnly
          onCopy={() => void onCopy()}
          blenderVersion={payload.blender_version_string}
          showMinimap={showMinimap}
        />
        {fallback ? (
          <div className="fallback">
            <p>Copy this text, then paste it in Blender.</p>
            <textarea readOnly value={fallback} autoFocus onFocus={(e) => e.target.select()} />
          </div>
        ) : null}
      </div>
    </>
  )
}
