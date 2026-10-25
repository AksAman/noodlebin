import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { CurveMappingWidget, CurvePoint, NoodleBinNode } from "@noodlebin/interchange"
import { curveChannels, curvePathD, curveView, evaluateCurve } from "../src/curve"
import { estimatedHeight } from "../src/layout"
import { CurveMappingView } from "../src/widgets"

const view = { minX: 0, minY: 0, maxX: 1, maxY: 1 }

function point(x: number, y: number, handle_type = "AUTO"): CurvePoint {
  return { location: [x, y], handle_type }
}

function mapping(curves: CurvePoint[][]): CurveMappingWidget {
  return {
    use_clip: true,
    clip_min_x: 0,
    clip_min_y: 0,
    clip_max_x: 1,
    clip_max_y: 1,
    extend: "EXTRAPOLATED",
    curves: curves.map((points) => ({ points })),
  }
}

function nodeWithCurves(count: number): NoodleBinNode {
  return {
    id: "n1",
    bl_idname: "ShaderNodeRGBCurve",
    name: "RGB Curves",
    label: "",
    location: [0, 0],
    location_absolute: [0, 0],
    width: 240,
    parent_id: null,
    mute: false,
    hide: false,
    hide_unused_sockets: false,
    use_custom_color: false,
    color: null,
    properties: {},
    widgets: {
      mapping: mapping(Array.from({ length: count }, () => [point(0, 0), point(1, 1)])),
    },
    sockets: { inputs: [], outputs: [] },
    group_tree_id: null,
    zone_pair_id: null,
  }
}

describe("curve channels", () => {
  test("RGB combined curve is the selected channel", () => {
    expect(curveChannels(4, "ShaderNodeRGBCurve").map((channel) => channel.label)).toEqual(["C", "R", "G", "B"])
    expect(curveChannels(4, "ShaderNodeRGBCurve").find((channel) => channel.active)?.index).toBe(3)
  })

  test("vector curves are X Y Z and hue curves are H S V", () => {
    expect(curveChannels(3, "ShaderNodeVectorCurve").map((channel) => channel.label)).toEqual(["X", "Y", "Z"])
    expect(curveChannels(3, "CompositorNodeHueCorrect").map((channel) => channel.label)).toEqual(["H", "S", "V"])
  })
})

describe("curve shape", () => {
  test("an identity curve is the diagonal of the grid", () => {
    const points = [point(0, 0), point(1, 1)]
    expect(evaluateCurve(points, "EXTRAPOLATED", 0)).toBeCloseTo(0, 4)
    expect(evaluateCurve(points, "EXTRAPOLATED", 0.5)).toBeCloseTo(0.5, 4)
    expect(evaluateCurve(points, "EXTRAPOLATED", 1)).toBeCloseTo(1, 4)
    const d = curvePathD(points, "EXTRAPOLATED", view)
    expect(d.startsWith("M 0.00 100.00")).toBe(true)
    expect(d.endsWith("100.00 0.00")).toBe(true)
  })

  test("auto-clamped peaks stay smooth instead of a polyline kink", () => {
    const points = [point(0, 0, "AUTO_CLAMPED"), point(0.5, 1, "AUTO_CLAMPED"), point(1, 0, "AUTO_CLAMPED")]
    const chord = 0.4 / 0.5
    expect(evaluateCurve(points, "EXTRAPOLATED", 0.4)).toBeGreaterThan(chord + 0.05)
  })

  test("vector handles stay piecewise linear", () => {
    const points = [point(0, 0, "VECTOR"), point(0.5, 0, "VECTOR"), point(1, 1, "VECTOR")]
    expect(evaluateCurve(points, "EXTRAPOLATED", 0.25)).toBeCloseTo(0, 2)
    expect(evaluateCurve(points, "EXTRAPOLATED", 0.75)).toBeCloseTo(0.5, 2)
  })

  test("horizontal extend holds the end value", () => {
    const points = [point(0.25, 0.25), point(0.75, 0.75)]
    expect(evaluateCurve(points, "HORIZONTAL", 0)).toBeCloseTo(0.25, 2)
    expect(evaluateCurve(points, "EXTRAPOLATED", 0)).toBeCloseTo(0, 2)
  })
})

describe("curve widget", () => {
  test("every channel shares one grid", () => {
    const html = renderToStaticMarkup(
      <CurveMappingView widget={mapping(Array.from({ length: 4 }, () => [point(0, 0), point(1, 1)]))} blIdname="ShaderNodeRGBCurve" />,
    )
    const plot = html.slice(html.indexOf("nv-curve-plot"))
    expect(plot.match(/<svg/g)).toHaveLength(1)
    expect(html).toContain('class="nv-curve-ch nv-curve-ch-on">C')
    expect(html).toContain(">R<")
    expect(html).toContain(">G<")
    expect(html).toContain(">B<")
  })

  test("clip bounds are the grid, and unclipped points expand it", () => {
    const clipped = curveView(mapping([[point(0, 0), point(2, 2)]]))
    expect(clipped).toEqual(view)
    const open = curveView({ ...mapping([[point(0, 0), point(2, 2)]]), use_clip: false })
    expect(open.maxX).toBe(2)
    expect(open.maxY).toBe(2)
  })

  test("layout reserves one plot no matter how many channels", () => {
    expect(estimatedHeight(nodeWithCurves(4), null)).toBe(estimatedHeight(nodeWithCurves(1), null))
  })
})
