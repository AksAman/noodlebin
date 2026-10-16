import { coverByteBudget, payloadTooLargeMessage } from "@/lib/publishBody"

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality))
}

/** Re-encode a still so the multipart request stays under the function body cap. GIFs are left as-is. */
export async function fitCoverFile(file: File, budget: number): Promise<File> {
  if (budget < 32_000) throw new Error(payloadTooLargeMessage())
  if (file.size <= budget && file.type !== "image/gif") return file
  if (file.type === "image/gif") {
    if (file.size <= budget) return file
    throw new Error("That GIF is larger than 4 MB. Vercel rejects it before it can be saved. Use a JPEG, PNG, or WebP.")
  }
  const bitmap = await createImageBitmap(file)
  const maxEdge = 1920
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not prepare the cover image.")
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  let quality = 0.86
  let blob: Blob | null = null
  for (; quality >= 0.45; quality -= 0.12) {
    blob = await canvasBlob(canvas, "image/jpeg", quality)
    if (blob && blob.size <= budget) break
  }
  if (!blob || blob.size > budget) throw new Error(payloadTooLargeMessage())
  return new File([blob], "cover.jpg", { type: "image/jpeg" })
}
