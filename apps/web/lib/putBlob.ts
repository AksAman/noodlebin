import type { UploadKind } from "@/lib/blobUpload"

/**
 * Uploads a file straight to Azure.
 * Null means this server is still accepting the file in the form.
 * The returned token is what publish expects in `${kind}_blob`.
 */
export async function putBlob(kind: UploadKind, file: File): Promise<string | null> {
  const contentType = file.type || (kind === "blend" ? "application/octet-stream" : "")
  const res = await fetch(`/api/uploads/${kind}`, {
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
  const put = await fetch(body.uploadUrl, {
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
