import { describe, expect, test } from "bun:test"
import { postBySlug, posts, postsByAuthor } from "@/lib/posts"

describe("static posts", () => {
  test("four handwritten fixtures have slugs and trees", () => {
    expect(posts).toHaveLength(4)
    for (const post of posts) {
      expect(post.tree.format).toBe("nodevault.tree")
      expect(post.tree.trees.length).toBeGreaterThan(0)
      expect(postBySlug(post.slug)?.title).toBe(post.title)
    }
    expect(postsByAuthor("nodevault")).toHaveLength(4)
    expect(postBySlug("missing")).toBeUndefined()
  })
})
