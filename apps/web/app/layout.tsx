import { SiteNav } from "@/components/SiteNav"
import type { ReactNode } from "react"
import "./globals.css"
import "@xyflow/react/dist/style.css"
import "@/node-view/styles.css"

export const metadata = {
  metadataBase: new URL("http://localhost:5173"),
  title: "NodeVault",
  description: "Copy Blender nodes to the browser and paste them back",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="m-0 flex h-full flex-col bg-nv-bg font-sans text-nv-fg">
        <SiteNav />
        {children}
      </body>
    </html>
  )
}
