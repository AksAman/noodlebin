import { SiteNav } from "@/components/SiteNav"
import type { ReactNode } from "react"
import "@xyflow/react/dist/style.css"
import "@/node-view/styles.css"
import "./globals.css"

export const metadata = {
  title: "NodeVault",
  description: "Copy Blender nodes to the browser and paste them back",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  )
}
