export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}

export const shell = "flex min-h-0 flex-1 flex-col"

export const gallery = "mx-auto w-full max-w-[960px] px-5 pb-12 pt-6"

export const btn =
  "cursor-pointer rounded border border-[#555] bg-[#303030] px-3 py-1.5 text-[13px] text-nv-fg disabled:opacity-60"

export const btnAccent =
  "inline-block cursor-pointer rounded border border-nv-accent-edge bg-nv-accent px-3 py-1.5 text-center text-[13px] font-semibold text-nv-ink no-underline disabled:opacity-60"

export const field =
  "rounded-md border border-[#3f3f3f] bg-[#141414] px-2.5 py-2 text-[#e4e4e4]"

export const notice =
  "rounded border border-[#6a5a20] bg-[#3a3218] px-2 py-1 text-xs"

export const canvas = "relative min-h-0 flex-1"

export const fallback =
  "absolute inset-x-[12%] inset-y-12 z-[8] flex flex-col gap-2 rounded-md border border-[#555] bg-[#1e1e1e] p-4"

const treeArt: Record<string, string> = {
  ShaderNodeTree: "bg-[linear-gradient(135deg,#4a3820,#1e1a14)]",
  GeometryNodeTree: "bg-[linear-gradient(135deg,#204a38,#141e1a)]",
  CompositorNodeTree: "bg-[linear-gradient(135deg,#20304a,#14181e)]",
}

export function treeArtClass(treeType: string): string {
  return cn("min-h-[120px] bg-[#2a2a2a]", treeArt[treeType])
}
