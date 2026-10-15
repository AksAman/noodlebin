"use client"

import { ShareSheet } from "@/components/ShareSheet"
import { NodeView } from "@/node-view"
import { shippedCatalogs } from "@/lib/catalogs"
import { ingestText, serializeCopy, treeTypeLabel } from "@/lib/ingest"
import type { CatalogResolution } from "@/catalog"
import type { NodeVaultPayload } from "@/interchange"
import { btn, btnAccent, canvas, fallback, notice as noticeClass, shell } from "@/lib/ui"
import { useCallback, useEffect, useRef, useState } from "react"

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
  const [fallbackText, setFallbackText] = useState<string | null>(null)
  const [showMinimap, setShowMinimap] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
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
    setFallbackText(null)
    setPublishedUrl(null)
    setShareOpen(true)
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
      setFallbackText(null)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setFallbackText(text)
    }
  }, [payload])

  const root = payload?.trees.find((t) => t.is_root) ?? payload?.trees[0]
  const groups = payload ? payload.trees.length - 1 : 0

  return (
    <div className={shell}>
      {payload && root ? (
        <>
          <div className="flex shrink-0 items-center gap-3 border-b border-nv-line bg-nv-raised px-3 py-2 text-[13px]">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <strong>{treeTypeLabel(payload.tree_type)}</strong>
              <span>{payload.blender_version_string}</span>
              <span>
                {payload.origin.node_count} node{payload.origin.node_count === 1 ? "" : "s"}
                {groups > 0 ? ` · ${groups} group${groups === 1 ? "" : "s"}` : ""}
              </span>
              {notice ? (
                <span className={noticeClass}>
                  {notice}
                  <button type="button" className="ml-2 cursor-pointer border-0 bg-transparent text-[#ccc]" onClick={() => setNotice(null)} aria-label="Dismiss">
                    ×
                  </button>
                </span>
              ) : null}
              {publishedUrl ? (
                <a className="text-xs text-[#d4a574] no-underline" href={publishedUrl}>
                  Shared
                </a>
              ) : null}
            </div>
            <div className="flex gap-2">
              {!publishedUrl ? (
                <button type="button" className={btnAccent} onClick={() => setShareOpen(true)}>
                  Share
                </button>
              ) : null}
              <button type="button" className={btn} onClick={() => setShowMinimap((v) => !v)}>
                {showMinimap ? "Hide map" : "Show map"}
              </button>
              <button type="button" className={btn} onClick={() => void onCopy()}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className={btn}
                onClick={() => {
                  setPayload(null)
                  setResolution(null)
                  setError(null)
                  setFallbackText(null)
                  setShareOpen(false)
                  setPublishedUrl(null)
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <div className={canvas}>
            {error ? (
              <div className="absolute left-1/2 top-3 z-[6] max-w-xl -translate-x-1/2 rounded border border-[#744] bg-[#3a1818] px-3 py-2 text-[13px]">
                {error}
              </div>
            ) : null}
            <NodeView
              tree={root}
              trees={payload.trees}
              catalog={resolution?.catalog ?? null}
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
            {shareOpen ? (
              <div className="absolute inset-0 z-[12] flex justify-end">
                <button type="button" className="absolute inset-0 cursor-pointer border-0 bg-[rgb(12_12_12_/_55%)]" aria-label="Dismiss share" onClick={() => setShareOpen(false)} />
                <ShareSheet
                  payload={payload}
                  onClose={(url) => {
                    setShareOpen(false)
                    if (url) setPublishedUrl(url)
                  }}
                />
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[radial-gradient(circle,#4e4e4e_1.5px,#171717_2px)] bg-[size:40px_40px] p-8">
          <p className="m-0 text-[11px] tracking-[0.16em] text-[#8a8a8a] uppercase">Paste</p>
          <p className="max-w-md text-center text-xl leading-snug">Copy nodes in Blender, then paste here. Share when you want a link.</p>
          {error ? <p className="max-w-xl text-center text-sm text-[#e8a0a0]">{error}</p> : null}
        </div>
      )}
    </div>
  )
}
