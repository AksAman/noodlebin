import { describe, expect, test } from "bun:test"
import { searchScore, type SearchablePost } from "@/lib/search"

function post(patch: Partial<SearchablePost> & Pick<SearchablePost, "title">): SearchablePost {
  return {
    description: null,
    author_name: "Aman",
    tags: [],
    tree: null,
    ...patch,
  }
}

describe("search priority", () => {
  test("a title hit outranks a Blender type that merely contains the letters", () => {
    const titled = post({ title: "RGB in a frame" })
    const buried = post({
      title: "53 shader nodes",
      tree: {
        format: "nodevault.tree",
        format_version: 1,
        blender_version: [5, 1, 0],
        blender_version_string: "5.1.0",
        tree_type: "ShaderNodeTree",
        copied_at: "2026-10-15T18:00:00Z",
        origin: { selection_center: [0, 0], node_count: 1 },
        trees: [
          {
            id: "root",
            name: "Shader",
            is_root: true,
            interface: [],
            nodes: [
              {
                id: "n1",
                bl_idname: "ShaderNodeValToRGB",
                name: "Color Ramp",
                label: "",
                location: [0, 0],
                width: 240,
                mute: false,
                hide: false,
                inputs: [],
                outputs: [],
              },
            ],
            links: [],
          },
        ],
      } as SearchablePost["tree"],
    })
    expect(searchScore(titled, "rgb")).toBeGreaterThan(searchScore(buried, "rgb"))
    expect(searchScore(buried, "rgb")).toBeGreaterThan(0)
  })
})
