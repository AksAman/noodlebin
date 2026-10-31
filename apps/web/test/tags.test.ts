import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { suggestTags, TAG_LIMIT } from "@/lib/tags"
import { createStoredPost, listTagCounts } from "@/lib/store"
import { parseCreateForm, isSharingError } from "@/lib/sharing"
import { parseNoodleBinText } from "@/interchange"

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

const fixturePath = join(
  import.meta.dir,
  "../../../fixtures/handwritten/three-stop-ramp.noodlebin.json",
)

const dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "noodlebin-tags-"))
  dirs.push(dir)
  process.env["NOODLEBIN_DATA_DIR"] = dir
  return dir
}

afterEach(() => {
  delete process.env["NOODLEBIN_DATA_DIR"]
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

function coverFile(): File {
  return new File([png], "cover.png", { type: "image/png" })
}

async function makePost(dir: string, tags: string[], visibility: "public" | "unlisted" = "public") {
  const treeText = (await import("node:fs/promises").then((m) => m.readFile(fixturePath, "utf8")))
  const body = new FormData()
  body.set("title", `Post ${Math.random().toFixed(6)}`)
  body.set("tree_text", treeText)
  body.set("cover", coverFile())
  body.set("tags", tags.join(","))
  body.set("visibility", visibility)
  const parsed = await parseCreateForm(body, parseNoodleBinText)
  if (isSharingError(parsed)) throw new Error(parsed.error)
  await createStoredPost(parsed, dir)
}

// ──────────────────────────────────────────────────────────────────────────────
// listTagCounts (disk store)
// ──────────────────────────────────────────────────────────────────────────────

describe("listTagCounts (disk store)", () => {
  test("returns empty list when there are no posts", async () => {
    const dir = tempDir()
    const tags = await listTagCounts(dir)
    expect(tags).toEqual([])
  })

  test("counts tags across public posts", async () => {
    const dir = tempDir()
    await makePost(dir, ["nodes", "shader"])
    await makePost(dir, ["nodes", "geometry"])
    const tags = await listTagCounts(dir)
    // "nodes" appears twice — must be first
    expect(tags[0]).toBe("nodes")
    expect(tags).toContain("shader")
    expect(tags).toContain("geometry")
  })

  test("most popular tag comes first", async () => {
    const dir = tempDir()
    await makePost(dir, ["rare"])
    await makePost(dir, ["common", "rare"])
    await makePost(dir, ["common"])
    const tags = await listTagCounts(dir)
    expect(tags[0]).toBe("common")
  })

  test("excludes tags from unlisted posts", async () => {
    const dir = tempDir()
    await makePost(dir, ["public-tag"])
    await makePost(dir, ["secret-tag"], "unlisted")
    const tags = await listTagCounts(dir)
    expect(tags).toContain("public-tag")
    expect(tags).not.toContain("secret-tag")
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// suggestTags
// ──────────────────────────────────────────────────────────────────────────────

describe("suggestTags", () => {
  const all = ["geometry", "shader", "nodes", "animation", "texture", "lighting", "rigging", "vfx"]

  test("returns top tags when draft is empty", () => {
    const suggestions = suggestTags(all, [], "")
    expect(suggestions).toEqual(all.slice(0, 6))
  })

  test("prefix matches come before substring matches", () => {
    // "shader" starts with "sh"; "mesh" doesn't but contains no "sh" — use another list
    const list = ["shadertoy", "shader", "freshen", "brush"]
    const suggestions = suggestTags(list, [], "sh")
    expect(suggestions.indexOf("shadertoy")).toBeLessThan(suggestions.indexOf("freshen"))
    expect(suggestions.indexOf("shader")).toBeLessThan(suggestions.indexOf("freshen"))
  })

  test("excludes already chosen tags", () => {
    const suggestions = suggestTags(all, ["geometry", "shader"], "")
    expect(suggestions).not.toContain("geometry")
    expect(suggestions).not.toContain("shader")
  })

  test("returns empty when tag limit is reached", () => {
    const chosen = Array.from({ length: TAG_LIMIT }, (_, i) => `tag${i}`)
    expect(suggestTags(all, chosen, "")).toEqual([])
  })

  test("returns empty when no matches exist", () => {
    const suggestions = suggestTags(all, [], "zzz")
    expect(suggestions).toEqual([])
  })

  test("handles a draft that normalizes to an empty token", () => {
    // A draft of only special chars collapses to "" after tagToken
    const suggestions = suggestTags(all, [], "---")
    // Token is "", so it should behave like empty draft
    expect(suggestions).toEqual(all.slice(0, 6))
  })

  test("respects the max parameter", () => {
    const suggestions = suggestTags(all, [], "", 3)
    expect(suggestions).toHaveLength(3)
  })
})
