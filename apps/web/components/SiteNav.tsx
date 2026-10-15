"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function SiteNav() {
  const pathname = usePathname()
  return (
    <nav className="site-nav">
      <Link className="site-mark" href="/">
        NodeVault
      </Link>
      <Link className={pathname === "/" ? "active" : ""} href="/">
        Gallery
      </Link>
      <Link className={pathname === "/paste" ? "active" : ""} href="/paste">
        Paste
      </Link>
    </nav>
  )
}
