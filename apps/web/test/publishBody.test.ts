import { describe, expect, test } from "bun:test"
import { coverByteBudget, publishFailureMessage } from "@/lib/publishBody"

describe("publish body budget", () => {
  test("leaves room for a cover after the graph", () => {
    expect(coverByteBudget(200_000)).toBeGreaterThan(1_000_000)
  })

  test("a graph near the function cap leaves no room for a cover", () => {
    expect(coverByteBudget(3_700_000)).toBeLessThan(0)
  })

  test("names the Vercel payload error", () => {
    expect(publishFailureMessage(413, "Request Entity Too Large\nFUNCTION_PAYLOAD_TOO_LARGE")).toContain("4 MB")
    expect(publishFailureMessage(401, '{"error":"Publish token required."}')).toBeNull()
  })
})
