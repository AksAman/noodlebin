import type { UploadKind } from "@/lib/blobUpload"

/** Browser network failures surface as TypeError "Failed to fetch", including the first Azure PUT while CORS settles. */
async function send(url: string, init: RequestInit): Promise<Response> {
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch(url, init)
    } catch (err) {
      last = err
      if (!(err instanceof TypeError) || attempt === 2) break
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }
  if (last instanceof TypeError) {
    throw new Error("Could not reach storage. Check your connection and publish again.")
  }
  throw last
}

/**
 * Uploads a file straight to Azure.
 * Null means this server is still accepting the file in the form.
 * The returned token is what publish expects in `${kind}_blob`.
 */
export async function putBlob(kind: UploadKind, file: File): Promise<string | null> {
  const contentType = file.type || (kind === "blend" ? "application/octet-stream" : "")
  const res = await send(`/api/uploads/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType, byteSize: file.size, filename: file.name }),
  })
  if (res.status === 404) return null
  const body = (await res.json().catch(() => null)) as {
    error?: string
    uploadUrl?: string
    token?: string
    contentType?: string
  } | null
  if (!res.ok || !body?.uploadUrl || !body.token || !body.contentType) {
    throw new Error(body?.error || "Could not start the upload.")
  }
  const put = await send(body.uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": body.contentType,
    },
  })
  if (!put.ok) throw new Error("Could not upload the file.")
  return body.token
}
