import { describe, expect, test } from "bun:test"
import { isSafeSlug, isVercelBlobUrl } from "@/lib/media"
import { sniffBlend, sniffCover, sniffMp4 } from "@/lib/sniff"

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

describe("sniff", () => {
  test("recognizes png and rejects html", () => {
    expect(sniffCover(png)?.ext).toBe("png")
    expect(sniffCover(Buffer.from("<html>x</html>"))).toBeNull()
  })

  test("mp4 needs an ftyp box", () => {
    const mp4 = Buffer.alloc(12)
    mp4[4] = 0x66
    mp4[5] = 0x74
    mp4[6] = 0x79
    mp4[7] = 0x70
    expect(sniffMp4(mp4)).toBe(true)
    expect(sniffMp4(png)).toBe(false)
  })

  test("blend magic", () => {
    expect(sniffBlend(Buffer.from("BLENDER-v401"))).toBe(true)
    expect(sniffBlend(Buffer.from([0x1f, 0x8b, 0x08]))).toBe(true)
    expect(sniffBlend(png)).toBe(false)
  })
})

describe("slug", () => {
  test("rejects path traversal", () => {
    expect(isSafeSlug("three-stop-ramp")).toBe(true)
    expect(isSafeSlug("../etc/passwd")).toBe(false)
    expect(isSafeSlug("a/b")).toBe(false)
    expect(isSafeSlug("")).toBe(false)
  })
})

describe("blob urls", () => {
  test("rejects lookalike hosts", () => {
    expect(isVercelBlobUrl("https://abc.blob.vercel-storage.com/files/x")).toBe(true)
    expect(isVercelBlobUrl("https://evil.com/.blob.vercel-storage.com/x")).toBe(false)
    expect(isVercelBlobUrl("https://blob.vercel-storage.com.evil.com/x")).toBe(false)
  })
})
