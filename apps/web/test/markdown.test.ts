import { describe, expect, test } from "bun:test"
import { markdownPlain } from "@/lib/markdownText"

describe("markdownPlain", () => {
  test("strips formatting for link previews", () => {
    expect(markdownPlain("**Use** the `Color Ramp`\n\n- before pasting")).toBe("Use the Color Ramp before pasting")
  })

  test("keeps a plain note unchanged", () => {
    expect(markdownPlain("A note about stops")).toBe("A note about stops")
  })
})
