"use client"

import { markdownPreviewProps } from "@/components/MarkdownNote"
import { useColorMode } from "@/components/useColorMode"
import { cn, field } from "@/lib/ui"
import "@uiw/react-md-editor/markdown-editor.css"
import "@uiw/react-markdown-preview/markdown.css"
import dynamic from "next/dynamic"
import { useMemo, useState } from "react"

/** Keep in step with the description length check in sharing.ts. */
const DESCRIPTION_MAX = 4000

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => <div className={cn(field, "h-[220px]")} />,
})

export function MarkdownField({
  id,
  name,
  defaultValue = "",
  placeholder,
}: {
  id: string
  name: string
  defaultValue?: string
  placeholder?: string
}) {
  const [value, setValue] = useState(defaultValue)
  const mode = useColorMode()
  const previewOptions = useMemo(() => ({ ...markdownPreviewProps, className: "note-markdown" }), [])

  return (
    <div className="markdown-field wmde-markdown-var" {...(mode ? { "data-color-mode": mode } : {})}>
      <input type="hidden" name={name} value={value} />
      <MDEditor
        value={value}
        onChange={(next) => setValue((next ?? "").slice(0, DESCRIPTION_MAX))}
        preview="edit"
        height={220}
        minHeight={140}
        maxHeight={420}
        autoFocus={false}
        visibleDragbar
        previewOptions={previewOptions}
        textareaProps={{
          id,
          placeholder,
          maxLength: DESCRIPTION_MAX,
          spellCheck: true,
        }}
        commandsFilter={(command) => (command.name === "fullscreen" ? false : command)}
      />
    </div>
  )
}
