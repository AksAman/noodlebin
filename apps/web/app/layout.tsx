import { BootScript } from "@/components/BootScript";
import { SessionProvider } from "@/components/SessionProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { getRequestSession } from "@/lib/auth";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { pasteBootScript } from "@/lib/pasteSession";
import { siteOrigin } from "@/lib/site";
import { themeBootScript } from "@/lib/theme";
import "@/node-view/styles.css";
import { Analytics } from "@vercel/analytics/next";
import "@xyflow/react/dist/style.css";
import type { Metadata } from "next";
import { Funnel_Display, Funnel_Sans, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

const display = Funnel_Display({
  subsets: ["latin"],
  variable: "--font-funnel-display",
  display: "swap",
});
const sans = Funnel_Sans({
  subsets: ["latin"],
  variable: "--font-funnel-sans",
  display: "swap",
});
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const SITE_TITLE = `${BRAND_NAME} · Share Blender node trees as links`;
const SITE_DESCRIPTION = `${BRAND_TAGLINE}. Share Shader, Geometry Nodes, and Compositor node trees as links.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const headerList = await headers();
  const embed = headerList.get("x-noodlebin-embed") === "1";
  const session = embed ? null : await getRequestSession();
  return (
    <html
      lang="en"
      className={`h-full ${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <BootScript html={themeBootScript} />
        <BootScript html={pasteBootScript} />
      </head>
      <body className="m-0 flex h-full flex-col bg-bg font-sans text-[15px] text-fg">
        <SessionProvider session={session}>
          {embed ? null : <SiteNav />}
          {children}
          {embed ? null : <SiteFooter />}
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
