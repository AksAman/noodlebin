export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}

export const shell = "flex min-h-0 flex-1 flex-col"

/** Scrolling pages: grow to fill the screen but never shrink, so the footer follows the content. */
export const docShell = "flex flex-[1_0_auto] flex-col"

export const container = "mx-auto w-full max-w-[1240px] px-5 sm:px-8"

export const page = `${container} pb-24`

const btnBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-medium no-underline transition-colors duration-150 ease-out-quart disabled:cursor-default disabled:opacity-55"

export const btn = cn(btnBase, "border border-line-strong bg-surface text-fg hover:border-subtle")

export const btnAccent = cn(btnBase, "border border-transparent bg-accent text-accent-ink hover:bg-accent-hover")

export const btnGhost = cn(btnBase, "border border-transparent bg-transparent text-muted hover:bg-sunken hover:text-fg")

export const field =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[14px] text-fg placeholder:text-subtle focus-visible:border-accent focus-visible:outline-none"

export const notice = "rounded-md bg-warn-bg px-2.5 py-1 text-xs text-warn-fg"

export const errorBox = "rounded-md bg-danger-bg px-3 py-2 text-[13px] text-danger-fg"

export const canvas = "relative min-h-0 flex-1 bg-canvas"

export const fallback =
  "absolute inset-x-[8%] inset-y-10 z-[8] flex flex-col gap-3 rounded-lg border border-line-strong bg-surface p-4 text-fg shadow-[0_24px_60px_-20px_rgb(0_0_0_/_60%)]"

export const meta = "text-[13px] text-muted tabular-nums"

const treeDot: Record<string, string> = {
  ShaderNodeTree: "bg-tree-shader",
  GeometryNodeTree: "bg-tree-geometry",
  CompositorNodeTree: "bg-tree-compositor",
}

export function treeDotClass(treeType: string): string {
  return cn("inline-block size-2 shrink-0 rounded-full", treeDot[treeType] ?? "bg-subtle")
}

const editorName: Record<string, string> = {
  ShaderNodeTree: "Shader Editor",
  GeometryNodeTree: "Geometry Node Editor",
  CompositorNodeTree: "Compositor",
}

export function treeEditorName(treeType: string): string {
  return editorName[treeType] ?? "node editor"
}
