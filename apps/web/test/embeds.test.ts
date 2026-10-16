import { describe, expect, test } from "bun:test"
import { parseTweet, parseYouTube, youTubeEmbedSrc } from "@/lib/embeds"

describe("parseYouTube", () => {
  test.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["youtube.com/watch?v=dQw4w9WgXcQ&list=PL123", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("%s", (raw, id) => {
    expect(parseYouTube(raw)?.id).toBe(id)
  })

  test("keeps a start time and normalizes the URL", () => {
    const link = parseYouTube("https://youtu.be/dQw4w9WgXcQ?t=1m30s")
    expect(link?.start).toBe(90)
    expect(link?.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s")
    expect(youTubeEmbedSrc(link!)).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=90")
  })

  test.each([
    "https://www.youtube.com/@blenderguru",
    "https://www.youtube.com/playlist?list=PL123",
    "https://vimeo.com/123456",
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "not a url",
  ])("rejects %s", (raw) => {
    expect(parseYouTube(raw)).toBeNull()
  })
})

describe("parseTweet", () => {
  test.each([
    ["https://x.com/blender/status/1790000000000000000", "blender"],
    ["https://twitter.com/blender/status/1790000000000000000?s=20", "blender"],
    ["mobile.twitter.com/blender/statuses/1790000000000000000", "blender"],
    ["https://x.com/i/web/status/1790000000000000000", "i"],
  ])("%s", (raw, user) => {
    const link = parseTweet(raw)
    expect(link?.id).toBe("1790000000000000000")
    expect(link?.user).toBe(user)
    expect(link?.url).toBe(`https://x.com/${user}/status/1790000000000000000`)
  })

  test.each(["https://x.com/blender", "https://x.com/blender/status/abc", "https://notx.com/a/status/1790000000000000000"])(
    "rejects %s",
    (raw) => {
      expect(parseTweet(raw)).toBeNull()
    },
  )
})
