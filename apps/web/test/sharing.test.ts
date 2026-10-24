import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET as getPost, PATCH } from "@/app/api/posts/[slug]/route";
import { GET, POST } from "@/app/api/posts/route";
import { parseNodeVaultText } from "@/interchange";
import { publishPost } from "@/lib/publishPost";
import {
  hashEditToken,
  isSharingError,
  parseCreateForm,
  slugify,
  tokenMatches,
  uniqueSlug,
} from "@/lib/sharing";
import {
  authorGallery,
  createStoredPost,
  deleteOwnedPost,
  getPublicPost,
  updateOwnedPost,
} from "@/lib/store";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const fixturePath = join(
  import.meta.dir,
  "../../../fixtures/handwritten/three-stop-ramp.nodevault.json",
);

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nodevault-share-"));
  dirs.push(dir);
  process.env["NODEVAULT_DATA_DIR"] = dir;
  return dir;
}

afterEach(() => {
  delete process.env["NODEVAULT_DATA_DIR"];
  delete process.env["PUBLISH_SECRET"];
  delete process.env["VERCEL"];
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function coverFile(): File {
  return new File([png], "cover.png", { type: "image/png" });
}

describe("slug and token", () => {
  test("slugify and uniqueSlug", () => {
    expect(slugify("Three-stop Color Ramp")).toBe("three-stop-color-ramp");
    expect(uniqueSlug("post", new Set(["post"]))).toBe("post-2");
  });

  test("token hash matches only the original", () => {
    const token = "secret-token-value";
    const hash = hashEditToken(token);
    expect(tokenMatches(token, hash)).toBe(true);
    expect(tokenMatches("other", hash)).toBe(false);
  });
});

describe("posts API", () => {
  test("GET lists seeded fixtures", async () => {
    tempDir();
    const res = await GET(new Request("http://nv.test/api/posts"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { posts: { slug: string }[] };
    console.log(body.posts);
    expect(body.posts.some((p) => p.slug === "homepage-background")).toBe(true);
  });

  test("POST without a cover is rejected", async () => {
    tempDir();
    const form = new FormData();
    form.set("title", "No cover");
    form.set("author_name", "Aman");
    form.set("tree_type", "ShaderNodeTree");
    form.set("blender_version_string", "5.1.0");
    const res = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: form }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("cover");
  });

  test("POST creates a public post without a payload", async () => {
    tempDir();
    const form = new FormData();
    form.set("title", "Cover only");
    form.set("author_name", "Aman");
    form.set("tree_type", "GeometryNodeTree");
    form.set("blender_version_string", "5.2.2");
    form.set("cover", coverFile());
    const res = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: form }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      url: string;
      edit_token: string;
      post: {
        slug: string;
        tree: unknown;
        cover_url: string;
        edit_token_hash?: string;
      };
    };
    expect(body.url).toBe(`/p/${body.post.slug}`);
    expect(body.edit_token.length).toBeGreaterThan(10);
    expect(body.post.tree).toBeNull();
    expect(body.post.cover_url).toContain("/api/media/");
    expect(body.post.edit_token_hash).toBeUndefined();

    const listed = await GET(
      new Request(
        "http://nv.test/api/posts?author=aman&tree_type=GeometryNodeTree",
      ),
    );
    const listBody = (await listed.json()) as { posts: { slug: string }[] };
    expect(listBody.posts.some((p) => p.slug === body.post.slug)).toBe(true);

    const one = await getPost(
      new Request(`http://nv.test/api/posts/${body.post.slug}`),
      {
        params: Promise.resolve({ slug: body.post.slug }),
      },
    );
    const oneBody = (await one.json()) as { post: { tree: unknown } };
    expect(oneBody.post.tree).toBeNull();
  });

  test("POST with pasted tree_text takes type and version from the payload", async () => {
    tempDir();
    const form = new FormData();
    form.set("title", "From paste");
    form.set("author_name", "Aman");
    form.set("tree_text", readFileSync(fixturePath, "utf8"));
    form.set("cover", coverFile());
    const res = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: form }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      post: {
        tree: { tree_type: string };
        tree_type: string;
        blender_version_string: string;
      };
    };
    const payload = parseNodeVaultText(readFileSync(fixturePath, "utf8"));
    expect(body.post.tree_type).toBe(payload.tree_type);
    expect(body.post.blender_version_string).toBe(
      payload.blender_version_string,
    );
    expect(body.post.tree.tree_type).toBe(payload.tree_type);
  });

  test("PATCH with the edit token attaches a payload", async () => {
    tempDir();
    const form = new FormData();
    form.set("title", "Needs tree");
    form.set("author_name", "Aman");
    form.set("tree_type", "ShaderNodeTree");
    form.set("blender_version_string", "5.1.0");
    form.set("cover", coverFile());
    const created = (await (
      await POST(
        new Request("http://nv.test/api/posts", { method: "POST", body: form }),
      )
    ).json()) as { post: { slug: string }; edit_token: string };

    const patch = new FormData();
    patch.set(
      "tree",
      new File([readFileSync(fixturePath)], "three-stop-ramp.nodevault.json", {
        type: "application/json",
      }),
    );
    const res = await PATCH(
      new Request(`http://nv.test/api/posts/${created.post.slug}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${created.edit_token}` },
        body: patch,
      }),
      { params: Promise.resolve({ slug: created.post.slug }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      post: { tree: { format: string }; blender_version_string: string };
    };
    expect(body.post.tree.format).toBe("nodevault.tree");
    expect(body.post.blender_version_string).toBe(
      parseNodeVaultText(readFileSync(fixturePath, "utf8"))
        .blender_version_string,
    );
  });

  test("PATCH without a token is unauthorized", async () => {
    tempDir();
    const form = new FormData();
    form.set("title", "Locked");
    form.set("author_name", "Aman");
    form.set("tree_type", "ShaderNodeTree");
    form.set("blender_version_string", "5.1.0");
    form.set("cover", coverFile());
    const created = (await (
      await POST(
        new Request("http://nv.test/api/posts", { method: "POST", body: form }),
      )
    ).json()) as { post: { slug: string } };
    const res = await PATCH(
      new Request(`http://nv.test/api/posts/${created.post.slug}`, {
        method: "PATCH",
        body: new FormData(),
      }),
      {
        params: Promise.resolve({ slug: created.post.slug }),
      },
    );
    expect(res.status).toBe(401);
  });

  test("cover that is not an image is rejected even with an image MIME type", async () => {
    tempDir();
    const form = new FormData();
    form.set("title", "Fake cover");
    form.set("author_name", "Aman");
    form.set("tree_type", "ShaderNodeTree");
    form.set("blender_version_string", "5.1.0");
    form.set(
      "cover",
      new File([Buffer.from("<html>nope</html>")], "cover.png", {
        type: "image/png",
      }),
    );
    const res = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: form }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("jpeg");
  });

  test("POST without the publish secret is unauthorized when it is configured", async () => {
    tempDir();
    process.env["PUBLISH_SECRET"] = "correct-secret";
    const fields = () => {
      const form = new FormData();
      form.set("title", "Locked publish");
      form.set("author_name", "Aman");
      form.set("tree_type", "ShaderNodeTree");
      form.set("blender_version_string", "5.1.0");
      form.set("cover", coverFile());
      return form;
    };
    const denied = await POST(
      new Request("http://nv.test/api/posts", {
        method: "POST",
        body: fields(),
      }),
    );
    expect(denied.status).toBe(401);

    const ok = await POST(
      new Request("http://nv.test/api/posts", {
        method: "POST",
        headers: { "x-publish-token": "correct-secret" },
        body: fields(),
      }),
    );
    expect(ok.status).toBe(201);
  });

  test("the share action publishes without a client token", async () => {
    tempDir();
    process.env["PUBLISH_SECRET"] = "correct-secret";
    const form = new FormData();
    form.set("title", "From the sheet");
    form.set("author_name", "Aman");
    form.set("tree_type", "ShaderNodeTree");
    form.set("blender_version_string", "5.1.0");
    form.set("cover", coverFile());
    const created = await publishPost(form);
    expect("url" in created && created.url.startsWith("/p/")).toBe(true);
  });

  test("Vercel production refuses publish when PUBLISH_SECRET is missing", async () => {
    tempDir();
    process.env["VERCEL"] = "1";
    const form = new FormData();
    form.set("title", "Unconfigured");
    form.set("author_name", "Aman");
    form.set("tree_type", "ShaderNodeTree");
    form.set("blender_version_string", "5.1.0");
    form.set("cover", coverFile());
    const res = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: form }),
    );
    expect(res.status).toBe(503);
  });

  test("POST stores normalized YouTube and X links, and PATCH can change or clear them", async () => {
    tempDir();
    const form = new FormData();
    form.set("title", "With links");
    form.set("author_name", "Aman");
    form.set("tree_type", "ShaderNodeTree");
    form.set("blender_version_string", "5.1.0");
    form.set("cover", coverFile());
    form.set("youtube_url", "youtu.be/dQw4w9WgXcQ");
    form.set(
      "tweet_url",
      "https://twitter.com/blender/status/1790000000000000000?s=20",
    );
    const res = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: form }),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as {
      edit_token: string;
      post: {
        slug: string;
        youtube_url: string | null;
        tweet_url: string | null;
      };
    };
    expect(created.post.youtube_url).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(created.post.tweet_url).toBe(
      "https://x.com/blender/status/1790000000000000000",
    );

    const patch = new FormData();
    patch.set("youtube_url", "");
    const patched = await PATCH(
      new Request(`http://nv.test/api/posts/${created.post.slug}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${created.edit_token}` },
        body: patch,
      }),
      { params: Promise.resolve({ slug: created.post.slug }) },
    );
    expect(patched.status).toBe(200);
    const body = (await patched.json()) as {
      post: { youtube_url: string | null; tweet_url: string | null };
    };
    expect(body.post.youtube_url).toBeNull();
    expect(body.post.tweet_url).toBe(
      "https://x.com/blender/status/1790000000000000000",
    );
  });

  test("POST without links stores null for both", async () => {
    tempDir();
    const form = new FormData();
    form.set("title", "No links");
    form.set("author_name", "Aman");
    form.set("tree_type", "ShaderNodeTree");
    form.set("blender_version_string", "5.1.0");
    form.set("cover", coverFile());
    form.set("youtube_url", "");
    const res = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: form }),
    );
    const body = (await res.json()) as {
      post: { youtube_url: string | null; tweet_url: string | null };
    };
    expect(body.post.youtube_url).toBeNull();
    expect(body.post.tweet_url).toBeNull();
  });

  test("POST with a link that is not a single video or post is rejected", async () => {
    tempDir();
    const form = new FormData();
    form.set("title", "Bad link");
    form.set("author_name", "Aman");
    form.set("tree_type", "ShaderNodeTree");
    form.set("blender_version_string", "5.1.0");
    form.set("cover", coverFile());
    form.set("tweet_url", "https://x.com/blender");
    const res = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: form }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("X or Instagram");
  });

  test("POST accepts an Instagram reel in the X field and an mp4 cover", async () => {
    tempDir();
    const mp4 = Buffer.alloc(12);
    mp4[4] = 0x66;
    mp4[5] = 0x74;
    mp4[6] = 0x79;
    mp4[7] = 0x70;
    const form = new FormData();
    form.set("title", "Motion cover");
    form.set("author_name", "Aman");
    form.set("tree_type", "ShaderNodeTree");
    form.set("blender_version_string", "5.1.0");
    form.set("cover", new File([mp4], "cover.mp4", { type: "video/mp4" }));
    form.set(
      "tweet_url",
      "https://www.instagram.com/reel/Abcdefghij1/?igsh=abc",
    );
    const res = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: form }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      post: { tweet_url: string; cover_video: boolean; cover_url: string };
    };
    expect(body.post.tweet_url).toBe(
      "https://www.instagram.com/reel/Abcdefghij1/",
    );
    expect(body.post.cover_video).toBe(true);
    expect(body.post.cover_url).toContain("/api/media/");
  });

  test("non-mp4 video is rejected", async () => {
    tempDir();
    const form = new FormData();
    form.set("title", "Bad video");
    form.set("author_name", "Aman");
    form.set("tree_type", "ShaderNodeTree");
    form.set("blender_version_string", "5.1.0");
    form.set("cover", coverFile());
    form.set("video", new File([png], "clip.webm", { type: "video/webm" }));
    const res = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: form }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("video/mp4");
  });

  test("POST without a name is anonymous and still listed", async () => {
    tempDir();
    const form = new FormData();
    form.set("title", "No name");
    form.set("tree_type", "ShaderNodeTree");
    form.set("blender_version_string", "5.1.0");
    form.set("cover", coverFile());
    const res = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: form }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      post: { slug: string; author_name: string; author_slug: string | null };
    };
    expect(body.post.author_name).toBe("Anonymous");
    expect(body.post.author_slug).toBeNull();
    const listed = await GET(new Request("http://nv.test/api/posts"));
    const list = (await listed.json()) as { posts: { slug: string }[] };
    expect(list.posts.some((post) => post.slug === body.post.slug)).toBe(true);
  });

  test("unlisted posts stay off the gallery and search, and remain available by slug", async () => {
    tempDir();
    const tree = readFileSync(fixturePath, "utf8");
    const hidden = new FormData();
    hidden.set("title", "Hidden ramp");
    hidden.set("author_name", "Aman");
    hidden.set("cover", coverFile());
    hidden.set("tree_text", tree);
    hidden.set("visibility", "unlisted");
    hidden.set("tags", "secret");
    const created = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: hidden }),
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as { post: { slug: string } };

    const listed = await GET(
      new Request("http://nv.test/api/posts?q=color%20ramp"),
    );
    const list = (await listed.json()) as { posts: { slug: string }[] };
    expect(list.posts.some((post) => post.slug === body.post.slug)).toBe(false);

    const one = await getPost(
      new Request(`http://nv.test/api/posts/${body.post.slug}`),
      {
        params: Promise.resolve({ slug: body.post.slug }),
      },
    );
    expect(one.status).toBe(200);
  });

  test("search matches a title, a tag, and a node name", async () => {
    tempDir();
    const tree = readFileSync(fixturePath, "utf8");
    const form = new FormData();
    form.set("title", "Gallery ramp");
    form.set("description", "A note about stops");
    form.set("author_name", "Aman");
    form.set("cover", coverFile());
    form.set("tree_text", tree);
    form.set("tags", "procedural, studio");
    const created = await POST(
      new Request("http://nv.test/api/posts", { method: "POST", body: form }),
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as { post: { slug: string } };

    for (const q of ["gallery", "stops", "studio", "color ramp"]) {
      const listed = await GET(
        new Request(`http://nv.test/api/posts?q=${encodeURIComponent(q)}`),
      );
      const list = (await listed.json()) as { posts: { slug: string }[] };
      expect(list.posts.some((post) => post.slug === body.post.slug)).toBe(
        true,
      );
    }
    const tagged = await GET(
      new Request("http://nv.test/api/posts?tag=procedural"),
    );
    const tags = (await tagged.json()) as { posts: { slug: string }[] };
    expect(tags.posts.some((post) => post.slug === body.post.slug)).toBe(true);
  });
});

const rampPath = join(
  import.meta.dir,
  "../../../fixtures/handwritten/three-stop-ramp.nodevault.json",
);
const shaderPath = join(
  import.meta.dir,
  "../../../fixtures/handwritten/worked-example-shader.nodevault.json",
);

async function makeOwned(userId: string | null, title = "Owned graph") {
  const form = new FormData();
  form.set("title", title);
  form.set("author_name", "Aman");
  form.set("tree_type", "ShaderNodeTree");
  form.set("blender_version_string", "5.1.0");
  form.set("cover", coverFile());
  form.set("tree_text", readFileSync(rampPath, "utf8"));
  const parsed = await parseCreateForm(form, parseNodeVaultText);
  if (isSharingError(parsed)) throw new Error(parsed.error);
  parsed.user_id = userId;
  parsed.author_slug = userId ? "aman" : parsed.author_slug;
  return createStoredPost(parsed);
}

describe("owned posts", () => {
  test("the owner can rename, unlist, and replace the graph without changing the slug", async () => {
    tempDir();
    const created = await makeOwned("user-1");
    const replacement = parseNodeVaultText(readFileSync(shaderPath, "utf8"));
    const updated = await updateOwnedPost(created.post.slug, "user-1", {
      title: "Renamed graph",
      description: "A note",
      visibility: "unlisted",
      tags: ["ramp"],
      tree: replacement,
      files: {},
    });
    if (isSharingError(updated)) throw new Error(updated.error);
    expect(updated.post.slug).toBe(created.post.slug);
    expect(updated.post.title).toBe("Renamed graph");
    expect(updated.post.description).toBe("A note");
    expect(updated.post.visibility).toBe("unlisted");
    expect(updated.post.tags).toEqual(["ramp"]);
    expect(updated.post.tree?.blender_version_string).toBe(
      replacement.blender_version_string,
    );
    expect(updated.post.tree?.tree_type).toBe(replacement.tree_type);

    const listed = await GET(new Request("http://nv.test/api/posts"));
    const list = (await listed.json()) as { posts: { slug: string }[] };
    expect(list.posts.some((post) => post.slug === created.post.slug)).toBe(
      false,
    );
    const mine = await authorGallery("aman", true);
    expect(mine.some((post) => post.slug === created.post.slug)).toBe(true);
  });

  test("an update without a tree keeps the graph", async () => {
    tempDir();
    const created = await makeOwned("user-1");
    const updated = await updateOwnedPost(created.post.slug, "user-1", {
      title: "Same graph",
      description: null,
      visibility: "public",
      tags: [],
      files: {},
    });
    if (isSharingError(updated)) throw new Error(updated.error);
    expect(updated.post.tree).toEqual(created.post.tree);
    expect(updated.post.blender_version_string).toBe(
      created.post.blender_version_string,
    );
  });

  test("another user and an anonymous post cannot be changed", async () => {
    tempDir();
    const owned = await makeOwned("user-1");
    const denied = await updateOwnedPost(owned.post.slug, "user-2", {
      title: "Stolen",
      description: null,
      visibility: "public",
      tags: [],
      files: {},
    });
    expect(isSharingError(denied) && denied.status).toBe(403);
    const still = await getPublicPost(owned.post.slug);
    expect(still?.title).toBe("Owned graph");

    const anon = await makeOwned(null, "Anonymous graph");
    const anonDenied = await deleteOwnedPost(anon.post.slug, "user-1");
    expect(isSharingError(anonDenied) && anonDenied.status).toBe(403);
    expect(await getPublicPost(anon.post.slug)).toBeTruthy();
  });

  test("the owner can delete a post once", async () => {
    tempDir();
    const created = await makeOwned("user-1", "Going away");
    const removed = await deleteOwnedPost(created.post.slug, "user-1");
    expect(isSharingError(removed)).toBe(false);
    expect(await getPublicPost(created.post.slug)).toBeUndefined();
    const listed = await GET(new Request("http://nv.test/api/posts"));
    const list = (await listed.json()) as { posts: { slug: string }[] };
    expect(list.posts.some((post) => post.slug === created.post.slug)).toBe(
      false,
    );
    const again = await deleteOwnedPost(created.post.slug, "user-1");
    expect(isSharingError(again) && again.status).toBe(404);
  });

  test("fixture posts cannot be deleted", async () => {
    tempDir();
    const fixture = await deleteOwnedPost("homepage-background", "user-1");
    expect(isSharingError(fixture) && fixture.status).toBe(403);
  });
});
