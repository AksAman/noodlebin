import { getSessionCookie } from "better-auth/cookies"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // skipTrailingSlashRedirect is on for the PostHog proxy. Keep normal pages on one URL.
  if (
    pathname.length > 1 &&
    pathname.endsWith("/") &&
    !pathname.startsWith("/api/v1") &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    const url = new URL(request.url)
    url.pathname = pathname.replace(/\/+$/, "") || "/"
    return NextResponse.redirect(url, 308)
  }
  if (request.nextUrl.pathname.startsWith("/embed/")) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-noodlebin-embed", "1")
    return NextResponse.next({ request: { headers: requestHeaders } })
  }
  // Cookie presence only. /account still validates the session before rendering.
  if (request.nextUrl.pathname === "/account" && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }
  const match = request.nextUrl.pathname.match(/^\/@([^/]+)$/)
  if (!match) return NextResponse.next()
  const url = request.nextUrl.clone()
  url.pathname = `/author/${match[1]}`
  return NextResponse.rewrite(url)
}

export const config = {
  // /api/v1 is the PostHog rewrite. The proxy must not handle those requests.
  matcher: ["/((?!api/v1(?:/|$)).*)"],
}
