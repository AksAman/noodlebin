import type { CurveMappingWidget, CurvePoint } from "@noodlebin/interchange"

/**
 * Blender stores an RGB mapping as R, G, B, then combined.
 * The combined curve is index 3 and is the channel selected by default.
 * Vector curves are X Y Z. Hue Correct is H S V.
 */
export interface CurveChannel {
  index: number
  label: string
  tone: "c" | "r" | "g" | "b" | "h" | "s" | "v"
  active: boolean
}

export interface CurveView {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type HandleKind = "AUTO" | "AUTO_CLAMPED" | "VECTOR"

interface Triple {
  x: number
  y: number
  h1: HandleKind
  h2: HandleKind
  lx: number
  ly: number
  rx: number
  ry: number
}

const STEPS = 16

export function curveChannels(count: number, blIdname?: string): CurveChannel[] {
  if (blIdname === "CompositorNodeHueCorrect") {
    const hue: CurveChannel[] = [
      { index: 0, label: "H", tone: "h", active: true },
      { index: 1, label: "S", tone: "s", active: false },
      { index: 2, label: "V", tone: "v", active: false },
    ]
    return hue.slice(0, count)
  }
  if (count >= 4) {
    return [
      { index: 3, label: "C", tone: "c", active: true },
      { index: 0, label: "R", tone: "r", active: false },
      { index: 1, label: "G", tone: "g", active: false },
      { index: 2, label: "B", tone: "b", active: false },
    ]
  }
  if (count === 3) {
    return [
      { index: 0, label: "X", tone: "r", active: true },
      { index: 1, label: "Y", tone: "g", active: false },
      { index: 2, label: "Z", tone: "b", active: false },
    ]
  }
  return []
}

export function curveView(widget: CurveMappingWidget): CurveView {
  let minX = widget.clip_min_x
  let maxX = widget.clip_max_x
  let minY = widget.clip_min_y
  let maxY = widget.clip_max_y
  if (!widget.use_clip) {
    for (const curve of widget.curves) {
      for (const point of curve.points) {
        minX = Math.min(minX, point.location[0])
        maxX = Math.max(maxX, point.location[0])
        minY = Math.min(minY, point.location[1])
        maxY = Math.max(maxY, point.location[1])
      }
    }
  }
  if (!(maxX > minX)) maxX = minX + 1
  if (!(maxY > minY)) maxY = minY + 1
  return { minX, maxX, minY, maxY }
}

function handleKind(value: string): HandleKind {
  if (value === "VECTOR") return "VECTOR"
  if (value === "AUTO_CLAMPED") return "AUTO_CLAMPED"
  return "AUTO"
}

function calcHandle(bezt: Triple, prev: Triple | null, next: Triple | null) {
  let p1x: number
  let p1y: number
  let p3x: number
  let p3y: number
  if (!prev) {
    if (!next) return
    p3x = next.x
    p3y = next.y
    p1x = 2 * bezt.x - p3x
    p1y = 2 * bezt.y - p3y
  } else {
    p1x = prev.x
    p1y = prev.y
  }
  if (!next) {
    p3x = 2 * bezt.x - p1x
    p3y = 2 * bezt.y - p1y
  } else {
    p3x = next.x
    p3y = next.y
  }

  const dax = bezt.x - p1x
  const day = bezt.y - p1y
  const dbx = p3x - bezt.x
  const dby = p3y - bezt.y
  const lenA = Math.hypot(dax, day) || 1
  const lenB = Math.hypot(dbx, dby) || 1
  const auto = (kind: HandleKind) => kind === "AUTO" || kind === "AUTO_CLAMPED"

  if (auto(bezt.h1) || auto(bezt.h2)) {
    const tx = dbx / lenB + dax / lenA
    const ty = dby / lenB + day / lenA
    const len = Math.hypot(tx, ty) * 2.5614
    if (len !== 0) {
      if (auto(bezt.h1)) {
        const scale = lenA / len
        bezt.lx = bezt.x - tx * scale
        bezt.ly = bezt.y - ty * scale
        if (bezt.h1 === "AUTO_CLAMPED" && prev && next) {
          const y1 = prev.y - bezt.y
          const y2 = next.y - bezt.y
          if ((y1 <= 0 && y2 <= 0) || (y1 >= 0 && y2 >= 0)) bezt.ly = bezt.y
          else if (y1 <= 0) bezt.ly = Math.max(prev.y, bezt.ly)
          else bezt.ly = Math.min(prev.y, bezt.ly)
        }
      }
      if (auto(bezt.h2)) {
        const scale = lenB / len
        bezt.rx = bezt.x + tx * scale
        bezt.ry = bezt.y + ty * scale
        if (bezt.h2 === "AUTO_CLAMPED" && prev && next) {
          const y1 = prev.y - bezt.y
          const y2 = next.y - bezt.y
          if ((y1 <= 0 && y2 <= 0) || (y1 >= 0 && y2 >= 0)) bezt.ry = bezt.y
          else if (y1 <= 0) bezt.ry = Math.min(next.y, bezt.ry)
          else bezt.ry = Math.max(next.y, bezt.ry)
        }
      }
    }
  }
  if (bezt.h1 === "VECTOR") {
    bezt.lx = bezt.x - dax / 3
    bezt.ly = bezt.y - day / 3
  }
  if (bezt.h2 === "VECTOR") {
    bezt.rx = bezt.x + dbx / 3
    bezt.ry = bezt.y + dby / 3
  }
}

function correctEndpoint(first: Triple, second: Triple, side: "start" | "end") {
  if (first.h2 !== "AUTO") return
  if (side === "start") {
    const hlen = Math.hypot(first.rx - first.x, first.ry - first.y)
    let vx = Math.max(second.lx, first.x) - first.x
    let vy = second.ly - first.y
    const nlen = Math.hypot(vx, vy)
    if (nlen <= 1e-8) return
    vx = (vx / nlen) * hlen
    vy = (vy / nlen) * hlen
    first.rx = first.x + vx
    first.ry = first.y + vy
    first.lx = first.x - vx
    first.ly = first.y - vy
    return
  }
  const hlen = Math.hypot(first.lx - first.x, first.ly - first.y)
  let vx = Math.min(second.rx, first.x) - first.x
  let vy = second.ry - first.y
  const nlen = Math.hypot(vx, vy)
  if (nlen <= 1e-8) return
  vx = (vx / nlen) * hlen
  vy = (vy / nlen) * hlen
  first.lx = first.x + vx
  first.ly = first.y + vy
  first.rx = first.x - vx
  first.ry = first.y - vy
}

/** Keep the segment a function of x, matching BKE_curve_correct_bezpart. */
function correctSegment(start: Triple, end: Triple) {
  const h1x = start.x - start.rx
  const h1y = start.y - start.ry
  const h2x = end.x - end.lx
  const h2y = end.y - end.ly
  const len = end.x - start.x
  const len1 = Math.abs(h1x)
  const len2 = Math.abs(h2x)
  if (len1 + len2 === 0 || len <= 0 || len1 + len2 <= len) return
  const fac = len / (len1 + len2)
  start.rx = start.x - fac * h1x
  start.ry = start.y - fac * h1y
  end.lx = end.x - fac * h2x
  end.ly = end.y - fac * h2y
}

function triples(points: CurvePoint[]): Triple[] {
  const sorted = [...points].sort((a, b) => a.location[0] - b.location[0] || a.location[1] - b.location[1])
  const bezt: Triple[] = sorted.map((point) => {
    const kind = handleKind(point.handle_type)
    return {
      x: point.location[0],
      y: point.location[1],
      h1: kind,
      h2: kind,
      lx: point.location[0],
      ly: point.location[1],
      rx: point.location[0],
      ry: point.location[1],
    }
  })
  for (let i = 0; i < bezt.length; i++) {
    calcHandle(bezt[i]!, bezt[i - 1] ?? null, bezt[i + 1] ?? null)
  }
  if (bezt.length > 2) {
    correctEndpoint(bezt[0]!, bezt[1]!, "start")
    correctEndpoint(bezt[bezt.length - 1]!, bezt[bezt.length - 2]!, "end")
  }
  for (let i = 0; i < bezt.length - 1; i++) correctSegment(bezt[i]!, bezt[i + 1]!)
  return bezt
}

function bezier(start: Triple, end: Triple, t: number): [number, number] {
  const u = 1 - t
  const uu = u * u
  const tt = t * t
  const x = uu * u * start.x + 3 * uu * t * start.rx + 3 * u * tt * end.lx + tt * t * end.x
  const y = uu * u * start.y + 3 * uu * t * start.ry + 3 * u * tt * end.ly + tt * t * end.y
  return [x, y]
}

function unit(x: number, y: number): [number, number] {
  const n = Math.hypot(x, y)
  if (n < 1e-8) return [0, 0]
  return [x / n, y / n]
}

interface BuiltCurve {
  poly: Array<[number, number]>
  extIn: [number, number]
  extOut: [number, number]
}

function buildCurve(points: CurvePoint[]): BuiltCurve | null {
  if (points.length === 0) return null
  const bezt = triples(points)
  const first = bezt[0]!
  const last = bezt[bezt.length - 1]!
  const poly: Array<[number, number]> = [[first.x, first.y]]
  for (let i = 0; i < bezt.length - 1; i++) {
    const start = bezt[i]!
    const end = bezt[i + 1]!
    for (let step = 1; step <= STEPS; step++) poly.push(bezier(start, end, step / STEPS))
  }
  return {
    poly,
    extIn: unit(first.lx - first.x, first.ly - first.y),
    extOut: unit(last.x - last.rx, last.y - last.ry),
  }
}

function extrapolate(x: number, origin: [number, number], dir: [number, number], horizontal: boolean): number {
  if (horizontal || Math.abs(dir[0]) < 1e-8) return origin[1]
  return origin[1] + (dir[1] / dir[0]) * (x - origin[0])
}

export function evaluateCurve(points: CurvePoint[], extend: string, x: number): number {
  const built = buildCurve(points)
  if (!built) return 0
  const { poly, extIn, extOut } = built
  const horizontal = extend !== "EXTRAPOLATED"
  const first = poly[0]!
  const last = poly[poly.length - 1]!
  if (x <= first[0]) return extrapolate(x, first, extIn, horizontal)
  if (x >= last[0]) return extrapolate(x, last, extOut, horizontal)
  for (let i = 1; i < poly.length; i++) {
    const prev = poly[i - 1]!
    const next = poly[i]!
    if (x <= next[0] || i === poly.length - 1) {
      const span = next[0] - prev[0]
      const t = span === 0 ? 0 : (x - prev[0]) / span
      return prev[1] + (next[1] - prev[1]) * t
    }
  }
  return last[1]
}

export function curvePathD(points: CurvePoint[], extend: string, view: CurveView): string {
  const built = buildCurve(points)
  if (!built) return ""
  const { poly, extIn, extOut } = built
  const horizontal = extend !== "EXTRAPOLATED"
  const samples = poly.slice()
  const first = samples[0]!
  const last = samples[samples.length - 1]!
  if (view.minX < first[0] - 1e-6) {
    samples.unshift([view.minX, extrapolate(view.minX, first, extIn, horizontal)])
  }
  if (view.maxX > last[0] + 1e-6) {
    samples.push([view.maxX, extrapolate(view.maxX, last, extOut, horizontal)])
  }
  const spanX = view.maxX - view.minX
  const spanY = view.maxY - view.minY
  const cmds = samples.map(([x, y], index) => {
    const sx = ((x - view.minX) / spanX) * 100
    const sy = (1 - (y - view.minY) / spanY) * 100
    return `${index === 0 ? "M" : "L"} ${sx.toFixed(2)} ${sy.toFixed(2)}`
  })
  return cmds.join(" ")
}
