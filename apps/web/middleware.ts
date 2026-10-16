import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/embed/")) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-nodevault-embed", "1")
    return NextResponse.next({ request: { headers: requestHeaders } })
  }
  const match = request.nextUrl.pathname.match(/^\/@([^/]+)$/)
  if (!match) return NextResponse.next()
  const url = request.nextUrl.clone()
  url.pathname = `/author/${match[1]}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: "/:path*",
}
