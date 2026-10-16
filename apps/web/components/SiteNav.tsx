"use client"

import { ThemeToggle } from "@/components/ThemeToggle"
import { cn } from "@/lib/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function Mark() {
  return (
    <svg viewBox="0 0 28 16" aria-hidden="true" className="h-4 w-7">
      <path d="M5 4.5C14 4.5 14 11.5 23 11.5" fill="none" stroke="var(--tree-shader)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="4.5" cy="4.5" r="3" fill="var(--accent)" />
      <circle cx="23.5" cy="11.5" r="3" fill="var(--tree-geometry)" />
    </svg>
  )
}

export function SiteNav() {
  const pathname = usePathname()
  const link = (href: string, label: string, active: boolean) => (
    <Link
      className={cn(
        "rounded-md px-2.5 py-1.5 no-underline transition-colors duration-150",
        active ? "text-fg" : "text-muted hover:text-fg",
      )}
      aria-current={active ? "page" : undefined}
      href={href}
    >
      {label}
    </Link>
  )
  const onGallery = pathname === "/" || pathname.startsWith("/@") || pathname.startsWith("/author")
  return (
    <nav className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg px-4 text-[14px] sm:px-8">
      <Link className="mr-3 flex items-center gap-2 text-fg no-underline" href="/">
        <Mark />
        <span className="font-display text-[17px] font-semibold tracking-[-0.02em]">NodeVault</span>
      </Link>
      {link("/", "Gallery", onGallery)}
      {link("/paste", "Paste", pathname === "/paste")}
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </nav>
  )
}
