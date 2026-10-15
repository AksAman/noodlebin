"use client"

import { cn } from "@/lib/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function SiteNav() {
  const pathname = usePathname()
  const link = (href: string, label: string) => (
    <Link className={cn("text-[#aaa] no-underline", pathname === href && "text-[#eee]")} href={href}>
      {label}
    </Link>
  )
  return (
    <nav className="flex shrink-0 items-center gap-4 border-b border-nv-line bg-nv-panel px-4 py-2 text-[13px]">
      <Link className="mr-2 font-semibold text-[#eee] no-underline" href="/">
        NodeVault
      </Link>
      {link("/", "Gallery")}
      {link("/paste", "Paste")}
    </nav>
  )
}
