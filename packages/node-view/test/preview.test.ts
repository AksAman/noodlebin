import { describe, expect, test } from "bun:test"
import type { JsonObject, NodeVaultNode } from "@nodevault/interchange"
import { estimatedHeight } from "../src/layout"
import { paintTexturePreview } from "../src/texture-preview"

function previewNode(
  blIdname: string,
  properties: JsonObject = {},
  inputs: Record<string, number> = {},
): NodeVaultNode {
  return {
    id: "n1",
    bl_idname: blIdname,
    name: blIdname,
    label: "",
    location: [0, 0],
    location_absolute: [0, 0],
    width: 160,
    parent_id: null,
    mute: false,
    hide: false,
    hide_unused_sockets: false,
    use_custom_color: false,
    color: null,
    properties,
    widgets: {},
    sockets: {
      inputs: Object.entries(inputs).map(([identifier, default_value], index) => ({
        identifier,
        name: identifier,
        label: "",
        bl_idname: "NodeSocketFloat",
        type: "VALUE",
        index,
        default_value,
        hide: false,
        hide_value: false,
        enabled: true,
      })),
      outputs: [],
    },
    group_tree_id: null,
    zone_pair_id: null,
  }
}

function paint(node: NodeVaultNode, size = 24): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4)
  expect(paintTexturePreview(node, data, size)).toBe(true)
  return data
}

function spread(data: Uint8ClampedArray): number {
  let count = 0
  let mean = 0
  let m2 = 0
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i]!
    count++
    const d = v - mean
    mean += d / count
    m2 += d * (v - mean)
  }
  return Math.sqrt(m2 / count)
}

function delta(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0
  for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!)
  return sum
}

describe("texture previews", () => {
  test("noise thumbnail is a varying field, and scale changes it", () => {
    const coarse = paint(previewNode("ShaderNodeTexNoise", { noise_dimensions: "3D", noise_type: "FBM", normalize: true }))
    const fine = paint(
      previewNode("ShaderNodeTexNoise", { noise_dimensions: "3D", noise_type: "FBM", normalize: true }, { Scale: 20 }),
    )
    expect(spread(coarse)).toBeGreaterThan(8)
    expect(delta(coarse, fine)).toBeGreaterThan(200)
  })

  test("noise type and dimension change the picture", () => {
    const fbm = paint(previewNode("ShaderNodeTexNoise", { noise_type: "FBM" }))
    const ridged = paint(previewNode("ShaderNodeTexNoise", { noise_type: "RIDGED_MULTIFRACTAL" }, { Offset: 1 }))
    const bands = paint(previewNode("ShaderNodeTexNoise", { noise_dimensions: "1D", noise_type: "FBM" }))
    expect(delta(fbm, ridged)).toBeGreaterThan(200)
    expect(spread(bands)).toBeGreaterThan(4)
    expect(delta(fbm, bands)).toBeGreaterThan(200)
  })

  test("voronoi cells differ from an edge preview and from manhattan", () => {
    const cells = paint(previewNode("ShaderNodeTexVoronoi", { voronoi_dimensions: "3D", feature: "F1", distance: "EUCLIDEAN" }))
    const edges = paint(previewNode("ShaderNodeTexVoronoi", { feature: "DISTANCE_TO_EDGE" }))
    const manhattan = paint(previewNode("ShaderNodeTexVoronoi", { feature: "F1", distance: "MANHATTAN" }))
    expect(spread(cells)).toBeGreaterThan(8)
    expect(spread(edges)).toBeGreaterThan(4)
    expect(delta(cells, edges)).toBeGreaterThan(200)
    expect(delta(cells, manhattan)).toBeGreaterThan(50)
  })

  test("other nodes are not painted", () => {
    const data = new Uint8ClampedArray(8)
    expect(paintTexturePreview(previewNode("ShaderNodeMath"), data, 2)).toBe(false)
  })

  test("zone sizing reserves room for the thumbnail", () => {
    const node = previewNode("ShaderNodeTexNoise")
    expect(estimatedHeight(node, null, { texturePreview: true })).toBeGreaterThan(estimatedHeight(node, null))
    expect(estimatedHeight(previewNode("ShaderNodeMath"), null, { texturePreview: true })).toBe(
      estimatedHeight(previewNode("ShaderNodeMath"), null),
    )
  })
})
