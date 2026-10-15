import { NodeView } from "@nodevault/node-view"
import type { CatalogResolution } from "@nodevault/catalog"
import type { NodeVaultPayload } from "@nodevault/interchange"
import { useCallback, useEffect, useRef, useState } from "react"
import { shippedCatalogs } from "./catalogs"
import { ingestText, serializeCopy, treeTypeLabel } from "./ingest"

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable
}

export function PastePage() {
  const [payload, setPayload] = useState<NodeVaultPayload | null>(null)
  const [resolution, setResolution] = useState<CatalogResolution | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [fallback, setFallback] = useState<string | null>(null)
  const [showMinimap, setShowMinimap] = useState(true)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyText = useCallback((text: string) => {
    const result = ingestText(text, shippedCatalogs)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setError(null)
    setPayload(result.payload)
    setResolution(result.catalog)
    setNotice(result.catalog.notice)
    setFallback(null)
  }, [])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTextField(event.target)) return
      const text = event.clipboardData?.getData("text/plain") ?? ""
      if (!text.trim()) return
      event.preventDefault()
      applyText(text)
    }
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      const file = event.dataTransfer?.files[0]
      if (!file) return
      const name = file.name.toLowerCase()
      if (!name.endsWith(".json") && !name.endsWith(".nodevault.json")) return
      void file.text().then(applyText)
    }
    const onDragOver = (event: DragEvent) => {
      event.preventDefault()
    }
    document.addEventListener("paste", onPaste)
    document.addEventListener("drop", onDrop)
    document.addEventListener("dragover", onDragOver)
    return () => {
      document.removeEventListener("paste", onPaste)
      document.removeEventListener("drop", onDrop)
      document.removeEventListener("dragover", onDragOver)
    }
  }, [applyText])

  const onCopy = useCallback(async () => {
    if (!payload) return
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

  const root = payload?.trees.find((t) => t.is_root) ?? payload?.trees[0]
  const groups = payload ? payload.trees.length - 1 : 0

  return (
    <div className="app">
      {payload && root ? (
        <>
          <div className="topbar">
            <div className="topbar-meta">
              <strong>{treeTypeLabel(payload.tree_type)}</strong>
              <span>{payload.blender_version_string}</span>
              <span>
                {payload.origin.node_count} node{payload.origin.node_count === 1 ? "" : "s"}
                {groups > 0 ? ` · ${groups} group${groups === 1 ? "" : "s"}` : ""}
              </span>
              {notice ? (
                <span className="notice">
                  {notice}
                  <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
                    ×
                  </button>
                </span>
              ) : null}
            </div>
            <div className="topbar-actions">
              <button type="button" onClick={() => setShowMinimap((v) => !v)}>
                {showMinimap ? "Hide map" : "Show map"}
              </button>
              <button type="button" onClick={() => void onCopy()}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayload(null)
                  setResolution(null)
                  setError(null)
                  setFallback(null)
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="canvas-wrap">
            {error ? <div className="inline-error">{error}</div> : null}
            <NodeView
              tree={root}
              trees={payload.trees}
              catalog={resolution?.catalog ?? null}
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
      ) : (
        <div className="empty">
          <p className="empty-copy">Copy nodes in Blender with NodeVault, then paste here.</p>
          <label className="file-btn">
            Open .nodevault.json
            <input
              type="file"
              accept=".json,.nodevault.json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void file.text().then(applyText)
              }}
            />
          </label>
          {error ? <p className="empty-error">{error}</p> : null}
        </div>
      )}
    </div>
  )
}
