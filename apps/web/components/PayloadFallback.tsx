import { fallback } from "@/lib/ui"

export function PayloadFallback({ text }: { text: string }) {
  return (
    <div className={fallback} role="dialog" aria-label="Copy payload manually">
      <p className="m-0 text-[14px]">The browser blocked clipboard access. Select all of this text, copy it, then paste in Blender.</p>
      <textarea
        className="flex-1 resize-none rounded-md border border-line bg-sunken p-3 font-mono text-[11px] leading-relaxed text-fg"
        readOnly
        value={text}
        autoFocus
        onFocus={(e) => e.target.select()}
      />
    </div>
  )
}
