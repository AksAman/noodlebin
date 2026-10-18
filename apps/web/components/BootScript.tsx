"use client"

/**
 * Inline boot script for the root layout.
 *
 * The server emits an executable script so it runs while the browser parses
 * the document, before first paint. Client renders emit `text/plain` so React
 * does not warn about a script it will never execute. See Next.js
 * "Preventing flash before hydration".
 */
export function BootScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
