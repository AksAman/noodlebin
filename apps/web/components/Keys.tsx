"use client"

import { useEffect, useState } from "react"

export function useModKey(): string {
  const [mod, setMod] = useState("Ctrl")
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod("⌘")
  }, [])
  return mod
}

export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="whitespace-nowrap rounded border border-line-strong bg-surface px-1.5 py-px font-sans text-[12px] text-fg shadow-[0_1px_0_var(--line-strong)]">
      {children}
    </kbd>
  )
}
