"use client"

import { useEffect, useId, useRef, type ReactNode } from "react"
import { cn } from "@/lib/ui"

export function Dialog({
  title,
  subtitle,
  onClose,
  wide = false,
  children,
}: {
  title: string
  subtitle?: ReactNode
  onClose: () => void
  wide?: boolean
  children: ReactNode
}) {
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current()
    }
    document.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer border-0 bg-[oklch(0.12_0.006_60/68%)]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex max-h-[min(88vh,760px)] w-full max-w-[28rem] animate-[rise_280ms_var(--ease-out-expo)_both] flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface text-fg shadow-[0_32px_80px_-28px_rgb(0_0_0/70%)]",
          wide && "md:max-h-[min(88vh,840px)] md:max-w-[36rem]",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="m-0 font-display text-xl font-semibold tracking-[-0.02em]">
              {title}
            </h2>
            {subtitle ? <div className="mt-1 text-[13px] text-muted">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-line-strong bg-bg text-fg hover:border-subtle"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
