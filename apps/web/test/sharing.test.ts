import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { GET as getPost, PATCH } from "@/app/api/posts/[slug]/route"
import { GET, POST } from "@/app/api/posts/route"
import { parseNodeVaultText } from "@/interchange"
import { hashEditToken, slugify, tokenMatches, uniqueSlug } from "@/lib/sharing"

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

const fixturePath = join(import.meta.dir, "../../../fixtures/handwritten/three-stop-ramp.nodevault.json")

const dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nodevault-share-"))
  dirs.push(dir)
  process.env["NODEVAULT_DATA_DIR"] = dir
  return dir
}

afterEach(() => {
  delete process.env["NODEVAULT_DATA_DIR"]
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function coverFile(): File {
  return new File([png], "cover.png", { type: "image/png" })
}

describe("slug and token", () => {
  test("slugify and uniqueSlug", () => {
    expect(slugify("Three-stop Color Ramp")).toBe("three-stop-color-ramp")
    expect(uniqueSlug("post", new Set(["post"]))).toBe("post-2")
  })

  test("token hash matches only the original", () => {
    const token = "secret-token-value"
    const hash = hashEditToken(token)
    expect(tokenMatches(token, hash)).toBe(true)
    expect(tokenMatches("other", hash)).toBe(false)
  })
})

describe("posts API", () => {
  test("GET lists seeded fixtures", async () => {
    tempDir()
    const res = await GET(new Request("http://nv.test/api/posts"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { posts: { slug: string }[] }
    expect(body.posts.some((p) => p.slug === "three-stop-ramp")).toBe(true)
  })

  test("POST without a cover is rejected", async () => {
    tempDir()
    const form = new FormData()
    form.set("title", "No cover")
    form.set("author_name", "Aman")
    form.set("tree_type", "ShaderNodeTree")
    form.set("blender_version_string", "5.1.0")
    const res = await POST(new Request("http://nv.test/api/posts", { method: "POST", body: form }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain("cover")
  })

  test("POST creates a public post without a payload", async () => {
    tempDir()
    const form = new FormData()
    form.set("title", "Cover only")
    form.set("author_name", "Aman")
    form.set("tree_type", "GeometryNodeTree")
    form.set("blender_version_string", "5.2.2")
    form.set("cover", coverFile())
    const res = await POST(new Request("http://nv.test/api/posts", { method: "POST", body: form }))
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      url: string
      edit_token: string
      post: { slug: string; tree: unknown; cover_url: string; edit_token_hash?: string }
    }
    expect(body.url).toBe(`/p/${body.post.slug}`)
    expect(body.edit_token.length).toBeGreaterThan(10)
    expect(body.post.tree).toBeNull()
    expect(body.post.cover_url).toContain("/api/media/")
    expect(body.post.edit_token_hash).toBeUndefined()

    const listed = await GET(new Request("http://nv.test/api/posts?author=aman&tree_type=GeometryNodeTree"))
    const listBody = (await listed.json()) as { posts: { slug: string }[] }
    expect(listBody.posts.some((p) => p.slug === body.post.slug)).toBe(true)

    const one = await getPost(new Request(`http://nv.test/api/posts/${body.post.slug}`), {
      params: Promise.resolve({ slug: body.post.slug }),
    })
    const oneBody = (await one.json()) as { post: { tree: unknown } }
    expect(oneBody.post.tree).toBeNull()
  })

  test("POST with pasted tree_text takes type and version from the payload", async () => {
    tempDir()
    const form = new FormData()
    form.set("title", "From paste")
    form.set("author_name", "Aman")
    form.set("tree_text", readFileSync(fixturePath, "utf8"))
    form.set("cover", coverFile())
    const res = await POST(new Request("http://nv.test/api/posts", { method: "POST", body: form }))
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      post: { tree: { tree_type: string }; tree_type: string; blender_version_string: string }
    }
    const payload = parseNodeVaultText(readFileSync(fixturePath, "utf8"))
    expect(body.post.tree_type).toBe(payload.tree_type)
    expect(body.post.blender_version_string).toBe(payload.blender_version_string)
    expect(body.post.tree.tree_type).toBe(payload.tree_type)
  })

  test("PATCH with the edit token attaches a payload", async () => {
    tempDir()
    const form = new FormData()
    form.set("title", "Needs tree")
    form.set("author_name", "Aman")
    form.set("tree_type", "ShaderNodeTree")
    form.set("blender_version_string", "5.1.0")
    form.set("cover", coverFile())
    const created = (await (
      await POST(new Request("http://nv.test/api/posts", { method: "POST", body: form }))
    ).json()) as { post: { slug: string }; edit_token: string }

    const patch = new FormData()
    patch.set("tree", new File([readFileSync(fixturePath)], "three-stop-ramp.nodevault.json", { type: "application/json" }))
    const res = await PATCH(
      new Request(`http://nv.test/api/posts/${created.post.slug}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${created.edit_token}` },
        body: patch,
      }),
      { params: Promise.resolve({ slug: created.post.slug }) },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { post: { tree: { format: string }; blender_version_string: string } }
    expect(body.post.tree.format).toBe("nodevault.tree")
    expect(body.post.blender_version_string).toBe(parseNodeVaultText(readFileSync(fixturePath, "utf8")).blender_version_string)
  })

  test("PATCH without a token is unauthorized", async () => {
    tempDir()
    const form = new FormData()
    form.set("title", "Locked")
    form.set("author_name", "Aman")
    form.set("tree_type", "ShaderNodeTree")
    form.set("blender_version_string", "5.1.0")
    form.set("cover", coverFile())
    const created = (await (
      await POST(new Request("http://nv.test/api/posts", { method: "POST", body: form }))
    ).json()) as { post: { slug: string } }
    const res = await PATCH(new Request(`http://nv.test/api/posts/${created.post.slug}`, { method: "PATCH", body: new FormData() }), {
      params: Promise.resolve({ slug: created.post.slug }),
    })
    expect(res.status).toBe(401)
  })

  test("non-mp4 video is rejected", async () => {
    tempDir()
    const form = new FormData()
    form.set("title", "Bad video")
    form.set("author_name", "Aman")
    form.set("tree_type", "ShaderNodeTree")
    form.set("blender_version_string", "5.1.0")
    form.set("cover", coverFile())
    form.set("video", new File([png], "clip.webm", { type: "video/webm" }))
    const res = await POST(new Request("http://nv.test/api/posts", { method: "POST", body: form }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain("video/mp4")
  })
})
