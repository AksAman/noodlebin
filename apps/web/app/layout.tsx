import { SiteFooter } from "@/components/SiteFooter"
import { SiteNav } from "@/components/SiteNav"
import { siteOrigin } from "@/lib/site"
import { themeBootScript } from "@/lib/theme"
import { Funnel_Display, Funnel_Sans, Geist_Mono } from "next/font/google"
import type { ReactNode } from "react"
import "./globals.css"
import "@xyflow/react/dist/style.css"
import "@/node-view/styles.css"

const display = Funnel_Display({ subsets: ["latin"], variable: "--font-funnel-display", display: "swap" })
const sans = Funnel_Sans({ subsets: ["latin"], variable: "--font-funnel-sans", display: "swap" })
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" })

export const metadata = {
  metadataBase: new URL(siteOrigin()),
  title: "NodeVault",
  description: "Copy Blender nodes to the browser and paste them back",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`h-full ${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="m-0 flex h-full flex-col bg-bg font-sans text-[15px] text-fg">
        <SiteNav />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
