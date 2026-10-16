import { describe, expect, test } from "bun:test"
import { claimHandle, handleBase } from "@/lib/handles"

describe("handles", () => {
  test("blank names become user", () => {
    expect(handleBase("...")).toBe("user")
    expect(handleBase("Aman Singh")).toBe("aman-singh")
  })

  test("a taken handle gets a suffix", () => {
    expect(claimHandle("aman", new Set(["aman"]))).toBe("aman-2")
    expect(claimHandle("aman", new Set(["aman", "aman-2"]))).toBe("aman-3")
  })
})
