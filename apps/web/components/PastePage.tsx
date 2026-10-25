"use client"

import { Kbd, useModKey } from "@/components/Keys"
import { BRAND_NAME } from "@/lib/brand"
import { PayloadFallback } from "@/components/PayloadFallback"
import { Dialog } from "@/components/Dialog"
import { ShareSheet } from "@/components/ShareSheet"
import { NodeView } from "@/node-view"
import { shippedCatalogs } from "@/lib/catalogs"
import { ingestText, serializeCopy, treeTypeLabel } from "@/lib/ingest"
import type { CatalogResolution } from "@/catalog"
import type { NoodleBinPayload } from "@/interchange"
import { btn, btnAccent, btnGhost, cn, errorBox, notice as noticeClass, shell, treeDotClass } from "@/lib/ui"
import { capture } from "@/lib/analytics"
import { clearPasteRestoring, clearPasteSession, readPasteSession, writePasteSession } from "@/lib/pasteSession"
import { clearShareDraft, readShareDraft, SHARE_DRAFT_KEY, type ShareDraft } from "@/lib/shareDraft"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable
}

export function PastePage() {
  const [payload, setPayload] = useState<NoodleBinPayload | null>(null)
  const [resolution, setResolution] = useState<CatalogResolution | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [fallbackText, setFallbackText] = useState<string | null>(null)
  const [showMinimap, setShowMinimap] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [restored, setRestored] = useState<ShareDraft | null>(null)
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const applyText = useCallback((text: string, options?: { openShare?: boolean; keepDraft?: boolean; source?: "paste" | "drop" }) => {
    const result = ingestText(text, shippedCatalogs)
    if (!result.ok) {
      setError(result.error.message)
      return false
    }
    if (options?.source) {
      capture("graph_pasted", {
        source: options.source,
        tree_type: result.payload.tree_type,
        node_count: result.payload.origin.node_count,
      })
    }
    writePasteSession(sessionStorage, text)
    if (!options?.keepDraft) {
      clearShareDraft(sessionStorage)
      setRestored(null)
    }
    setError(null)
    setPayload(result.payload)
    setResolution(result.catalog)
    setNotice(result.catalog.notice)
    setFallbackText(null)
    setPublishedUrl(null)
    setShareOpen(options?.openShare ?? true)
    return true
  }, [])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTextField(event.target)) return
      const text = event.clipboardData?.getData("text/plain") ?? ""
      if (!text.trim()) return
      event.preventDefault()
      applyText(text, { source: "paste" })
    }
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      const file = event.dataTransfer?.files[0]
      if (!file) return
      const name = file.name.toLowerCase()
      if (!name.endsWith(".json") && !name.endsWith(".noodlebin.json")) return
      void file.text().then((text) => applyText(text, { source: "drop" }))
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

  useLayoutEffect(() => {
    const draft = readShareDraft(sessionStorage.getItem(SHARE_DRAFT_KEY))
    if (draft) {
      setRestored(draft)
      applyText(draft.treeText, { keepDraft: true })
      clearPasteRestoring()
      return
    }
    const saved = readPasteSession(sessionStorage)
    if (!saved) {
      clearPasteRestoring()
      return
    }
    if (!applyText(saved, { openShare: false })) clearPasteSession(sessionStorage)
    clearPasteRestoring()
  }, [applyText])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest("a")
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return
      if (anchor.closest("[data-keep-draft]")) return
      if (!readShareDraft(sessionStorage.getItem(SHARE_DRAFT_KEY))) return
      let url: URL
      try {
        url = new URL(anchor.href, location.href)
      } catch {
        return
      }
      const here = `${location.pathname}${location.search}`
      const next = url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href
      if (url.origin === location.origin && `${url.pathname}${url.search}` === here) return
      event.preventDefault()
      event.stopPropagation()
      setLeaveTo(next)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  const onCopy = useCallback(async () => {
    if (!payload) return
    const text = serializeCopy(payload)
    try {
      await navigator.clipboard.writeText(text)
      capture("graph_copied", { surface: "paste", tree_type: payload.tree_type })
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
    <div data-fullbleed className={shell}>
      {payload && root ? (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-bg px-4 py-2.5 sm:px-8">
            <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted tabular-nums">
              <span className="inline-flex items-center gap-2 font-medium text-fg">
                <span className={treeDotClass(payload.tree_type)} aria-hidden="true" />
                {treeTypeLabel(payload.tree_type)}
              </span>
              <span>Blender {payload.blender_version_string}</span>
              <span>
                {payload.origin.node_count} node{payload.origin.node_count === 1 ? "" : "s"}
                {groups > 0 ? `, ${groups} group${groups === 1 ? "" : "s"}` : ""}
              </span>
              {notice ? (
                <span className={cn(noticeClass, "inline-flex items-center gap-2")}>
                  {notice}
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 text-[15px] leading-none text-current"
                    onClick={() => setNotice(null)}
                    aria-label="Dismiss notice"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {publishedUrl ? (
                <a className="text-accent-fg underline-offset-4 hover:underline" href={publishedUrl}>
                  View shared post
                </a>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  clearPasteRestoring()
                  clearPasteSession(sessionStorage)
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
              <button type="button" className={btnGhost} aria-pressed={showMinimap} onClick={() => setShowMinimap((v) => !v)}>
                {showMinimap ? "Hide map" : "Show map"}
              </button>
              <button type="button" className={btn} onClick={() => void onCopy()}>
                {copied ? "Copied" : "Copy for Blender"}
              </button>
              {!publishedUrl ? (
                <button
                  type="button"
                  className={btnAccent}
                  onClick={() => {
                    setRestored(readShareDraft(sessionStorage.getItem(SHARE_DRAFT_KEY)))
                    setShareOpen(true)
                  }}
                >
                  Share
                </button>
              ) : null}
            </div>
          </div>
          <div className="relative min-h-0 flex-1 bg-bg" data-node-canvas>
            {error ? (
              <div role="alert" className={cn(errorBox, "absolute left-1/2 top-3 z-[6] max-w-xl -translate-x-1/2")}>
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
            {fallbackText ? <PayloadFallback text={fallbackText} /> : null}
          </div>
          {shareOpen ? (
            <ShareSheet
              payload={payload}
              restored={restored}
              onClose={(url) => {
                setShareOpen(false)
                if (url) {
                  clearShareDraft(sessionStorage)
                  clearPasteSession(sessionStorage)
                  setRestored(null)
                  setPublishedUrl(url)
                }
              }}
            />
          ) : null}
        </>
      ) : (
        <EmptyState error={error} />
      )}
      {leaveTo ? (
        <Dialog title="Discard this share?" onClose={() => setLeaveTo(null)}>
          <div className="flex flex-col gap-4 px-5 py-5">
            <p className="m-0 text-[15px] leading-relaxed text-muted">
              The title, cover, and other fields in the share form will be discarded. The graph stays in this tab.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setLeaveTo(null)}>
                Stay
              </button>
              <button
                type="button"
                className={btnAccent}
                onClick={() => {
                  const href = leaveTo
                  clearShareDraft(sessionStorage)
                  setRestored(null)
                  setLeaveTo(null)
                  if (href.startsWith("http")) location.assign(href)
                  else router.push(href)
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}

function EmptyState({ error }: { error: string | null }) {
  const mod = useModKey()
  const steps = [
    <>Select nodes in any Blender node editor.</>,
    <>
      Press <Kbd>{`${mod} ⇧ C`}</Kbd> to copy them with the{" "}
      <Link className="text-accent-fg underline-offset-4 hover:underline" href="/addon">
        {BRAND_NAME} add-on
      </Link>
      .
    </>,
    <>
      Press <Kbd>{`${mod} V`}</Kbd> on this page.
    </>,
  ]
  return (
    <div className="paste-stage flex flex-1 items-center px-5 py-16 sm:px-12">
      <div data-paste-copy className="mx-auto w-full max-w-[1240px] animate-rise">
        <h1 className="m-0 font-display text-[clamp(2.75rem,1.6rem+4.4vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-fg">
          Paste a graph.
        </h1>
        <ol className="mt-10 grid max-w-3xl list-none gap-x-8 gap-y-5 p-0 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={i} className="border-t border-line-strong pt-4 text-[15px] leading-relaxed text-muted">
              <span className="mb-2 block font-display text-[22px] font-medium text-accent-fg tabular-nums">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-10 text-[14px] text-subtle">
          You can also drop a <span className="text-muted">.json</span> payload file anywhere on this page. Nothing is uploaded until
          you choose to share.
        </p>
        {error ? (
          <p role="alert" className={cn(errorBox, "mt-6 inline-block max-w-xl")}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
