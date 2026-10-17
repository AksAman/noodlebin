import { describe, expect, test } from "bun:test"
import { claimHandle, handleBase, providerUsername } from "@/lib/handles"

describe("handles", () => {
  test("blank names become user", () => {
    expect(handleBase("...")).toBe("user")
    expect(handleBase("Aman Singh")).toBe("aman-singh")
  })

  test("a taken handle gets a suffix", () => {
    expect(claimHandle("aman", new Set(["aman"]))).toBe("aman-2")
    expect(claimHandle("aman", new Set(["aman", "aman-2"]))).toBe("aman-3")
  })

  test("X and Discord usernames become the handle, not the display name", () => {
    const twitter = providerUsername({
      providerId: "twitter",
      profile: { data: { name: "Aman Kumar", username: "AmanKRSingh03" } },
    })
    expect(claimHandle(twitter!, new Set())).toBe("amankrsingh03")
    expect(claimHandle("Aman Kumar", new Set())).toBe("aman-kumar")

    expect(
      providerUsername({
        providerId: "discord",
        profile: { global_name: "Aman Kumar", username: "amankrsingh" },
      }),
    ).toBe("amankrsingh")
    expect(providerUsername({ providerId: "google", profile: { name: "Aman Kumar" } })).toBeUndefined()
  })
})
