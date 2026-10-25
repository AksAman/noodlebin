import { describe, expect, test } from "bun:test"
import { blenderToCanvas, cssColor, cssThemeColor, linearToSrgb } from "../src/index"
import { nodeTitle } from "../src/layout"
import { parseNoodleBinText } from "@noodlebin/interchange"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { treeToFlow } from "../src/graph"

const fixture = join(import.meta.dir, "../../../fixtures/handwritten/worked-example-shader.noodlebin.json")

describe("coordinates", () => {
  test("flips blender Y", () => {
    expect(blenderToCanvas([-300, 40])).toEqual({ x: -300, y: -40 })
  })

  test("sRGB transfer", () => {
    expect(linearToSrgb(0)).toBe(0)
    expect(linearToSrgb(1)).toBeCloseTo(1, 5)
    expect(linearToSrgb(0.0031308)).toBeCloseTo(12.92 * 0.0031308, 5)
  })

  test("theme colors are not double-converted", () => {
    const converter = [0.1411764770746231, 0.38431376218795776, 0.5137255191802979]
    expect(cssThemeColor(converter)).toBe("rgb(36, 98, 131)")
    expect(cssColor(converter)).not.toBe(cssThemeColor(converter))
  })
})

describe("treeToFlow", () => {
  test("two-node fixture is two cards and one edge", () => {
    const payload = parseNoodleBinText(readFileSync(fixture, "utf8"))
    const root = payload.trees[0]!
    const { nodes, edges } = treeToFlow(root, null, payload.blender_version_string, payload.trees)
    const cards = nodes.filter((n) => n.data.kind !== "zone-bg")
    expect(cards.map((n) => n.id).sort()).toEqual(["n1", "n2"])
    expect(edges).toHaveLength(1)
    expect(edges[0]?.source).toBe("n1")
    expect(edges[0]?.target).toBe("n2")
    expect(edges[0]?.sourceHandle).toBe("out:Fac")
    expect(edges[0]?.targetHandle).toBe("in:Roughness")
    expect(cards.find((n) => n.id === "n1")?.position).toEqual({ x: -300, y: -0 })
    expect(cards.every((n) => n.draggable && n.selectable && n.deletable === false)).toBe(true)
    expect(nodeTitle(root.nodes[0]!, null)).toBe("Noise Texture")
  })

  test("ramp widget stays on the node", () => {
    const payload = parseNoodleBinText(
      readFileSync(join(import.meta.dir, "../../../fixtures/handwritten/three-stop-ramp.noodlebin.json"), "utf8"),
    )
    const { nodes } = treeToFlow(payload.trees[0]!, null, "5.1.0", payload.trees)
    const ramp = nodes.find((n) => n.id === "n1")
    expect(ramp?.data.payloadNode.widgets.color_ramp?.elements).toHaveLength(3)
  })

  test("frame sits behind its child, which moves with it", () => {
    const payload = parseNoodleBinText(
      readFileSync(join(import.meta.dir, "../../../fixtures/handwritten/frame-child.noodlebin.json"), "utf8"),
    )
    const { nodes } = treeToFlow(payload.trees[0]!, null, "5.1.0", payload.trees)
    const frame = nodes.find((n) => n.id === "n1")
    const child = nodes.find((n) => n.id === "n2")
    expect(frame?.data.kind).toBe("frame")
    expect(frame?.zIndex).toBe(1)
    expect(child?.zIndex).toBe(2)
    expect(frame?.position).toEqual({ x: -40, y: -80 })
    expect(child?.parentId).toBe("n1")
    expect(child?.position).toEqual({ x: 20, y: 40 })
    expect(nodes.indexOf(frame!)).toBeLessThan(nodes.indexOf(child!))
    expect(frame?.draggable).toBe(true)
    expect(child?.draggable).toBe(true)
  })

  test("group node points at the inner tree", () => {
    const payload = parseNoodleBinText(
      readFileSync(join(import.meta.dir, "../../../fixtures/handwritten/group-inner.noodlebin.json"), "utf8"),
    )
    const { nodes } = treeToFlow(payload.trees[0]!, null, "5.1.0", payload.trees)
    expect(nodes.find((n) => n.id === "n1")?.data.kind).toBe("group")
    expect(nodes.find((n) => n.id === "n1")?.data.groupTree?.id).toBe("group:Inner")
  })
})
