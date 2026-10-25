import { describe, expect, test } from "bun:test"
import { azurePublicUrl, blendFilename, isBlobName, readBlobToken, signBlob } from "@/lib/blobUpload"

const cover = "covers/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png"
const video = "videos/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.mp4"
const blend = "blends/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.blend"

describe("blob upload tokens", () => {
  test("accepts a signed name for each kind and rejects a kind swap", () => {
    const token = signBlob("cover", cover, "secret")
    expect(readBlobToken(token, "secret")).toEqual({ kind: "cover", blobName: cover })
    expect(readBlobToken(token, "other")).toBeNull()
    expect(readBlobToken(signBlob("video", video, "secret"), "secret")?.kind).toBe("video")
    expect(readBlobToken(signBlob("blend", blend, "secret"), "secret")?.kind).toBe("blend")
    expect(readBlobToken(`video~${cover}~nope`, "secret")).toBeNull()
  })

  test("names stay inside the kind prefix", () => {
    expect(isBlobName("cover", cover)).toBe(true)
    expect(isBlobName("cover", cover.replace(/\.png$/, ".mp4"))).toBe(true)
    expect(isBlobName("cover", video)).toBe(false)
    expect(isBlobName("video", video)).toBe(true)
    expect(isBlobName("blend", blend)).toBe(true)
    expect(isBlobName("blend", "blends/../secret.blend")).toBe(false)
  })

  test("an azure path is a public blob url, or a CDN url when that base is set", () => {
    const previousAccount = process.env.AZURE_STORAGE_ACCOUNT
    const previousContainer = process.env.AZURE_STORAGE_CONTAINER
    const previousCdn = process.env.AZURE_CDN_BASE_URL
    process.env.AZURE_STORAGE_ACCOUNT = "noodlebin"
    process.env.AZURE_STORAGE_CONTAINER = "media"
    delete process.env.AZURE_CDN_BASE_URL
    try {
      expect(azurePublicUrl(`azure:${cover}`)).toBe(
        "https://noodlebin.blob.core.windows.net/media/covers/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png",
      )
      process.env.AZURE_CDN_BASE_URL = "https://noodlebin.azurefd.net/"
      expect(azurePublicUrl(`azure:${cover}`)).toBe(
        "https://noodlebin.azurefd.net/media/covers/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png",
      )
      expect(azurePublicUrl("azure:covers/../secret.png")).toBeNull()
    } finally {
      if (previousAccount === undefined) delete process.env.AZURE_STORAGE_ACCOUNT
      else process.env.AZURE_STORAGE_ACCOUNT = previousAccount
      if (previousContainer === undefined) delete process.env.AZURE_STORAGE_CONTAINER
      else process.env.AZURE_STORAGE_CONTAINER = previousContainer
      if (previousCdn === undefined) delete process.env.AZURE_CDN_BASE_URL
      else process.env.AZURE_CDN_BASE_URL = previousCdn
    }
  })

  test("blend filenames keep a safe .blend name", () => {
    expect(blendFilename("My Graph.blend")).toBe("My Graph.blend")
    expect(blendFilename("../etc/passwd")).toBe("graph.blend")
    expect(blendFilename("notes.txt")).toBe("graph.blend")
  })
})
