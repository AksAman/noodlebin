"use client"

import { Kbd, useModKey } from "@/components/Keys"
import { shippedCatalogs } from "@/lib/catalogs"
import { ingestText, treeTypeLabel } from "@/lib/ingest"
import { cn, treeDotClass } from "@/lib/ui"
import { useRef, useState, type ClipboardEvent } from "react"

type Ready = { text: string; treeType: string; nodes: number }

/**
 * Swaps a post's graph without ever showing the payload. Paste a copy from Blender onto the field
 * (or click it to read the clipboard); the text rides along in a hidden input and the form only
 * shows what the graph is.
 */
export function ReplaceGraphField({ name = "tree_text" }: { name?: string }) {
  const mod = useModKey()
  const [ready, setReady] = useState<Ready | null>(null)
  const [error, setError] = useState<string | null>(null)
  const zone = useRef<HTMLButtonElement>(null)

  function take(text: string) {
    if (!text.trim()) return
    const result = ingestText(text, shippedCatalogs)
    if (!result.ok) {
      setReady(null)
      setError(result.error.message)
      return
    }
    setError(null)
    setReady({ text, treeType: result.payload.tree_type, nodes: result.payload.origin.node_count })
  }

  function onPaste(event: ClipboardEvent<HTMLButtonElement>) {
    event.preventDefault()
    take(event.clipboardData.getData("text/plain"))
  }

  async function onClick() {
    try {
      take(await navigator.clipboard.readText())
    } catch {
      /* Clipboard reads can be blocked; the field stays focused so the shortcut still works. */
    }
    zone.current?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-fg">
        Replace graph <span className="font-normal text-subtle">(optional)</span>
      </span>
      <input type="hidden" name={name} value={ready?.text ?? ""} />
      {ready ? (
        <div className="flex items-center gap-3 rounded-md border border-line-strong bg-surface px-3 py-2.5 text-[13px] font-normal">
          <span className={treeDotClass(ready.treeType)} aria-hidden="true" />
          <span className="min-w-0 flex-1 text-fg">
            New graph ready
            <span className="text-muted tabular-nums">
              {" · "}
              {treeTypeLabel(ready.treeType)}
              {" · "}
              {ready.nodes} node{ready.nodes === 1 ? "" : "s"}
            </span>
          </span>
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-muted hover:text-fg"
            onClick={() => {
              setReady(null)
              setError(null)
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          ref={zone}
          type="button"
          onPaste={onPaste}
          onClick={() => void onClick()}
          className={cn(
            "w-full cursor-pointer rounded-md border border-dashed bg-transparent px-3 py-4 text-center text-[13px] font-normal text-muted",
            "transition-colors duration-150 hover:border-subtle hover:text-fg focus-visible:border-accent focus-visible:outline-none",
            error ? "border-danger-fg" : "border-line-strong",
          )}
        >
          Click to paste the nodes you copied in Blender, or press <Kbd>{`${mod} V`}</Kbd>
        </button>
      )}
      <span className="text-[12px] font-normal text-subtle">Leave this alone to keep the current graph.</span>
      {error ? (
        <span role="alert" className="text-[12px] font-normal text-danger-fg">
          {error}
        </span>
      ) : null}
    </div>
  )
}
