import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { NodeVaultNode } from "@nodevault/interchange"
import {
  MISSING_THEME_HEADER,
  UNKNOWN_NODE_HEADER,
  UNRESOLVED_SOCKET_COLOR,
  headerColor,
  indexCatalogs,
  loadCatalogDirectory,
  lookupNode,
  parseCatalogJson,
  resolveCatalog,
  socketColor,
  widgetId,
  type Catalog,
} from "../src/index"

const SHIPPED = join(import.meta.dir, "../../../catalog/versions")

function stubCatalog(version: [number, number, number], extra: Partial<Catalog> = {}): Catalog {
  return {
    blender_version: version,
    blender_version_string: version.join("."),
    extracted_at: "2026-10-15T00:00:00Z",
    theme_source: "factory",
    themes: { shader_node: [0.1, 0.4, 0.1], layout_node: [0.4, 0.4, 0.4] },
    socket_colors: { NodeSocketFloat: [0.63, 0.63, 0.63] },
    socket_colors_unresolved: [],
    categories: [],
    nodes: {
      ShaderNodeBsdfPrincipled: {
        bl_idname: "ShaderNodeBsdfPrincipled",
        label: "Principled BSDF",
        description: "",
        tree_types: ["ShaderNodeTree"],
        category_id: "shader",
        header_color: "shader_node",
        width_default: 240,
        inputs: [
          {
            identifier: "Scale",
            name: "Scale",
            label: "",
            bl_idname: "NodeSocketFloat",
            type: "VALUE",
            index: 0,
            default_value: 5,
            hide: false,
            hide_value: false,
            enabled: true,
          },
        ],
        outputs: [],
        properties: [],
        widget: "generic",
      },
      FictionalNewNode: {
        bl_idname: "FictionalNewNode",
        label: "Fictional",
        description: "",
        tree_types: ["ShaderNodeTree"],
        category_id: null,
        header_color: "shader_node",
        width_default: 140,
        inputs: [
          {
            identifier: "A",
            name: "A",
            label: "",
            bl_idname: "NodeSocketFloat",
            type: "VALUE",
            index: 0,
            hide: false,
            hide_value: false,
            enabled: true,
          },
          {
            identifier: "B",
            name: "B",
            label: "",
            bl_idname: "NodeSocketFloat",
            type: "VALUE",
            index: 1,
            hide: false,
            hide_value: false,
            enabled: true,
          },
        ],
        outputs: [],
        properties: [],
        widget: "generic",
      },
    },
    skipped: [],
    ...extra,
  }
}

function payloadNode(bl_idname: string, extra: Partial<NodeVaultNode> = {}): NodeVaultNode {
  return {
    id: "n1",
    bl_idname,
    name: bl_idname,
    label: "",
    location: [0, 0],
    location_absolute: [0, 0],
    width: 140,
    parent_id: null,
    mute: false,
    hide: false,
    hide_unused_sockets: false,
    use_custom_color: false,
    color: null,
    properties: {},
    widgets: {},
    sockets: { inputs: [], outputs: [] },
    group_tree_id: null,
    zone_pair_id: null,
    ...extra,
  }
}

describe("resolveCatalog", () => {
  test("exact blender_version wins", () => {
    const index = indexCatalogs([stubCatalog([5, 1, 0]), stubCatalog([5, 1, 2])])
    const r = resolveCatalog(index, [5, 1, 0])
    expect(r.match).toBe("exact")
    expect(r.catalog?.blender_version).toEqual([5, 1, 0])
    expect(r.notice).toBeNull()
  })

  test("same major.minor nearest patch, tie prefers the higher patch", () => {
    const index = indexCatalogs([stubCatalog([5, 1, 0]), stubCatalog([5, 1, 2])])
    const mid = resolveCatalog(index, [5, 1, 1])
    expect(mid.match).toBe("nearest_patch")
    expect(mid.used).toEqual([5, 1, 2])
    expect(mid.notice).toContain("5.1.1")
    expect(mid.notice).toContain("5.1.2")

    const low = resolveCatalog(index, [5, 1, 3])
    expect(low.used).toEqual([5, 1, 2])
  })

  test("no shared major.minor yields a missing catalog and a notice", () => {
    const index = indexCatalogs([stubCatalog([5, 1, 0])])
    const r = resolveCatalog(index, [4, 2, 0])
    expect(r.match).toBe("missing")
    expect(r.catalog).toBeNull()
    expect(r.notice).toContain("4.2.0")
    expect(r.notice).toContain("has not been extracted")
  })

  test("empty index is missing", () => {
    const r = resolveCatalog(indexCatalogs([]), [5, 1, 0])
    expect(r.match).toBe("missing")
    expect(r.catalog).toBeNull()
  })
})

describe("join", () => {
  const catalog = stubCatalog([5, 1, 0], {
    themes: { shader_node: [0.14, 0.71, 0.14] },
    socket_colors: { NodeSocketFloat: [0.63, 0.63, 0.63, 1] },
  })

  test("header color comes from themes[header_color]", () => {
    expect(headerColor(catalog, "ShaderNodeBsdfPrincipled")).toEqual([0.14, 0.71, 0.14])
  })

  test("missing theme key uses 0.25 gray", () => {
    const c = stubCatalog([5, 1, 0], { themes: {} })
    expect(headerColor(c, "ShaderNodeBsdfPrincipled")).toEqual([...MISSING_THEME_HEADER])
  })

  test("unknown bl_idname and null catalog use 0.2 gray", () => {
    expect(headerColor(catalog, "TotallyUnknown")).toEqual([...UNKNOWN_NODE_HEADER])
    expect(headerColor(null, "ShaderNodeBsdfPrincipled")).toEqual([...UNKNOWN_NODE_HEADER])
  })

  test("socket color from catalog, else unresolved gray", () => {
    expect(socketColor(catalog, "NodeSocketFloat")).toEqual([0.63, 0.63, 0.63, 1])
    expect(socketColor(catalog, "NodeSocketNope")).toEqual([...UNRESOLVED_SOCKET_COLOR])
    expect(socketColor(null, "NodeSocketFloat")).toEqual([...UNRESOLVED_SOCKET_COLOR])
  })

  test("a fictional generic entry is enough to look up sockets and a widget", () => {
    const rec = lookupNode(catalog, "FictionalNewNode")
    expect(rec).not.toBeNull()
    expect(rec!.widget).toBe("generic")
    expect(rec!.inputs).toHaveLength(2)
    expect(widgetId(catalog, payloadNode("FictionalNewNode"))).toBe("generic")
  })

  test("frame, reroute, and group widgets do not need a catalog entry", () => {
    expect(widgetId(null, payloadNode("NodeFrame"))).toBe("frame")
    expect(widgetId(null, payloadNode("NodeReroute"))).toBe("reroute")
    expect(widgetId(null, payloadNode("ShaderNodeGroup", { group_tree_id: "group:G" }))).toBe("group")
    expect(widgetId(null, payloadNode("ShaderNodeMath"))).toBe("generic")
  })
})

describe("loadCatalogDirectory", () => {
  test("loads the shipped 5.1.0 catalog", async () => {
    const index = await loadCatalogDirectory(SHIPPED)
    const r = resolveCatalog(index, [5, 1, 0])
    expect(r.match).toBe("exact")
    const principled = lookupNode(r.catalog, "ShaderNodeBsdfPrincipled")
    expect(principled?.header_color).toBe("shader_node")
    expect((principled?.inputs.length ?? 0) > 1).toBe(true)
    expect(headerColor(r.catalog, "ShaderNodeBsdfPrincipled")[1]).toBeGreaterThan(0.3)
    expect(r.catalog!.themes["shader_node"]).toBeDefined()
    const trees = new Set<string>()
    for (const rec of Object.values(r.catalog!.nodes)) {
      for (const t of rec.tree_types) trees.add(t)
    }
    expect(trees.has("ShaderNodeTree")).toBe(true)
    expect(trees.has("GeometryNodeTree")).toBe(true)
    expect(trees.has("CompositorNodeTree")).toBe(true)
  })

  test("reads every catalog.json one level down, ignores junk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nodevault-cats-"))
    await mkdir(join(dir, "5.0.1"))
    await mkdir(join(dir, "5.1.0"))
    await mkdir(join(dir, "not-a-catalog"))
    await writeFile(join(dir, "5.0.1", "catalog.json"), JSON.stringify(stubCatalog([5, 0, 1])))
    await writeFile(join(dir, "5.1.0", "catalog.json"), JSON.stringify(stubCatalog([5, 1, 0])))
    await writeFile(join(dir, "readme.txt"), "nope")
    const index = await loadCatalogDirectory(dir)
    expect(index.catalogs.map((c) => c.blender_version)).toEqual([
      [5, 0, 1],
      [5, 1, 0],
    ])
    expect((await loadCatalogDirectory(join(dir, "missing"))).catalogs).toEqual([])
  })

  test("parseCatalogJson rejects random JSON", () => {
    expect(() => parseCatalogJson("{}")).toThrow(/Not a NodeVault catalog/)
    expect(() => parseCatalogJson("not json")).toThrow(/Invalid catalog JSON/)
  })
})
