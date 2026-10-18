"use client"

import { useColorMode } from "@/components/useColorMode"
import MarkdownPreview from "@uiw/react-markdown-preview"
import "@uiw/react-markdown-preview/markdown.css"
import { defaultUrlTransform, type ExtraProps } from "react-markdown"
import type { JSX } from "react"

function NoteLink({ node: _node, ...props }: JSX.IntrinsicElements["a"] & ExtraProps) {
  return <a {...props} target="_blank" rel="noreferrer noopener" />
}

/** Shared by the editor preview and the published note. Raw HTML stays off; only safe URLs render. */
export const markdownPreviewProps = {
  skipHtml: true,
  urlTransform: defaultUrlTransform,
  components: { a: NoteLink },
}

export function MarkdownNote({ source, className }: { source: string; className?: string }) {
  const mode = useColorMode()
  return (
    <MarkdownPreview
      {...markdownPreviewProps}
      {...(className ? { className } : {})}
      source={source}
      wrapperElement={mode ? { "data-color-mode": mode } : {}}
    />
  )
}
