import { authConfigured, ensureAuthReady, getAuth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handle(request: Request): Promise<Response> {
  if (!authConfigured()) {
    return Response.json({ error: "Sign-in is not configured." }, { status: 503 })
  }
  await ensureAuthReady()
  const handlers = toNextJsHandler(getAuth())
  if (request.method === "GET") return handlers.GET(request)
  if (request.method === "POST") return handlers.POST(request)
  return Response.json({ error: "Method not allowed." }, { status: 405 })
}

export const GET = handle
export const POST = handle
