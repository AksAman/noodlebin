import type { NoodleBinNode } from "@noodlebin/interchange"
import { linearToSrgb } from "./color"
import {
  hashFloatToFloat,
  hashFloatToVec3,
  hashInt,
  hashInt2,
  hashInt2ToVec2,
  hashInt2ToVec3,
  hashInt3,
  hashInt3ToVec3,
  hashInt4,
  hashInt4ToVec3,
  hashInt4ToVec4,
  hashVec2ToFloat,
} from "./hash"

/**
 * Thumbnails for Noise Texture and Voronoi Texture.
 * Sampled on a 0–1 generated-coordinate slice, using the node's own socket
 * values. A linked Vector or Scale is not evaluated.
 * 1D has no vector, so x sweeps the W input; otherwise the thumbnail is flat.
 */

const PREVIEW_NODES = new Set(["ShaderNodeTexNoise", "ShaderNodeTexVoronoi"])
const MAX_DETAIL = 8

export function hasTexturePreview(blIdname: string): boolean {
  return PREVIEW_NODES.has(blIdname)
}

type Dim = 1 | 2 | 3 | 4
type NoiseType = "MULTIFRACTAL" | "RIDGED_MULTIFRACTAL" | "HYBRID_MULTIFRACTAL" | "FBM" | "HETERO_TERRAIN"
type VoronoiMetric = "EUCLIDEAN" | "MANHATTAN" | "CHEBYCHEV" | "MINKOWSKI"
type VoronoiFeature = "F1" | "F2" | "SMOOTH_F1" | "DISTANCE_TO_EDGE" | "N_SPHERE_RADIUS"

type NoiseParams = {
  kind: "noise"
  dimensions: Dim
  noiseType: NoiseType
  normalize: boolean
  scale: number
  detail: number
  roughness: number
  lacunarity: number
  offset: number
  gain: number
  distortion: number
  w: number
}

type VoronoiParams = {
  kind: "voronoi"
  dimensions: Dim
  metric: VoronoiMetric
  feature: VoronoiFeature
  normalize: boolean
  scale: number
  detail: number
  roughness: number
  lacunarity: number
  smoothness: number
  exponent: number
  randomness: number
  w: number
}

type PreviewParams = NoiseParams | VoronoiParams

function socketNum(node: NoodleBinNode, id: string, fallback: number): number {
  const value = node.sockets.inputs.find((s) => s.identifier === id)?.default_value
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function dimOf(value: string): Dim {
  if (value === "1D" || value === "2D" || value === "4D") return Number(value[0]) as Dim
  return 3
}

function readParams(node: NoodleBinNode): PreviewParams | null {
  if (node.bl_idname === "ShaderNodeTexNoise") {
    const type = node.properties.noise_type
    const noiseType: NoiseType =
      type === "MULTIFRACTAL" ||
      type === "RIDGED_MULTIFRACTAL" ||
      type === "HYBRID_MULTIFRACTAL" ||
      type === "HETERO_TERRAIN" ||
      type === "FBM"
        ? type
        : "FBM"
    const normalize = node.properties.normalize
    return {
      kind: "noise",
      dimensions: dimOf(typeof node.properties.noise_dimensions === "string" ? node.properties.noise_dimensions : "3D"),
      noiseType,
      normalize: typeof normalize === "boolean" ? normalize : true,
      scale: socketNum(node, "Scale", 5),
      detail: Math.min(MAX_DETAIL, Math.max(0, socketNum(node, "Detail", 2))),
      roughness: Math.max(0, socketNum(node, "Roughness", 0.5)),
      lacunarity: socketNum(node, "Lacunarity", 2),
      offset: socketNum(node, "Offset", 0),
      gain: socketNum(node, "Gain", 1),
      distortion: socketNum(node, "Distortion", 0),
      w: socketNum(node, "W", 0),
    }
  }
  if (node.bl_idname === "ShaderNodeTexVoronoi") {
    const metric = node.properties.distance
    const feature = node.properties.feature
    const normalize = node.properties.normalize
    const voronoiMetric: VoronoiMetric =
      metric === "MANHATTAN" || metric === "CHEBYCHEV" || metric === "MINKOWSKI" || metric === "EUCLIDEAN"
        ? metric
        : "EUCLIDEAN"
    const voronoiFeature: VoronoiFeature =
      feature === "F2" ||
      feature === "SMOOTH_F1" ||
      feature === "DISTANCE_TO_EDGE" ||
      feature === "N_SPHERE_RADIUS" ||
      feature === "F1"
        ? feature
        : "F1"
    return {
      kind: "voronoi",
      dimensions: dimOf(typeof node.properties.voronoi_dimensions === "string" ? node.properties.voronoi_dimensions : "3D"),
      metric: voronoiMetric,
      feature: voronoiFeature,
      normalize: typeof normalize === "boolean" ? normalize : false,
      scale: socketNum(node, "Scale", 5),
      detail: Math.min(MAX_DETAIL, Math.max(0, socketNum(node, "Detail", 0))),
      roughness: Math.min(1, Math.max(0, socketNum(node, "Roughness", 0.5))),
      lacunarity: socketNum(node, "Lacunarity", 2),
      smoothness: Math.min(0.5, Math.max(0, socketNum(node, "Smoothness", 1) / 2)),
      exponent: socketNum(node, "Exponent", 0.5),
      randomness: Math.min(1, Math.max(0, socketNum(node, "Randomness", 1))),
      w: socketNum(node, "W", 0),
    }
  }
  return null
}

export function texturePreviewKey(node: NoodleBinNode): string {
  return JSON.stringify(readParams(node))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function mod(a: number, b: number): number {
  return a - b * Math.floor(a / b)
}

function wrap(p: number): number {
  const correction = Math.abs(p) >= 1_000_000 ? 0.5 : 0
  return mod(p, 100_000) + correction
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function negateIf(value: number, condition: number): number {
  return condition !== 0 ? -value : value
}

function grad1(hash: number, x: number): number {
  const h = hash & 15
  const g = 1 + (h & 7)
  return negateIf(g, h & 8) * x
}

function grad2(hash: number, x: number, y: number): number {
  const h = hash & 7
  const u = h < 4 ? x : y
  const v = 2 * (h < 4 ? y : x)
  return negateIf(u, h & 1) + negateIf(v, h & 2)
}

function grad3(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15
  const u = h < 8 ? x : y
  const vt = h === 12 || h === 14 ? x : z
  const v = h < 4 ? y : vt
  return negateIf(u, h & 1) + negateIf(v, h & 2)
}

function grad4(hash: number, x: number, y: number, z: number, w: number): number {
  const h = hash & 31
  const u = h < 24 ? x : y
  const v = h < 16 ? y : z
  const s = h < 8 ? z : w
  return negateIf(u, h & 1) + negateIf(v, h & 2) + negateIf(s, h & 4)
}

function perlin1(x: number): number {
  const x0 = Math.floor(x)
  const fx = x - x0
  const u = fade(fx)
  const xInt = x0 | 0
  return lerp(grad1(hashInt(xInt), fx), grad1(hashInt(xInt + 1), fx - 1), u)
}

function perlin2(x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const u = fade(fx)
  const v = fade(fy)
  const xi = x0 | 0
  const yi = y0 | 0
  const v0 = lerp(grad2(hashInt2(xi, yi), fx, fy), grad2(hashInt2(xi + 1, yi), fx - 1, fy), u)
  const v1 = lerp(grad2(hashInt2(xi, yi + 1), fx, fy - 1), grad2(hashInt2(xi + 1, yi + 1), fx - 1, fy - 1), u)
  return lerp(v0, v1, v)
}

function perlin3(x: number, y: number, z: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const z0 = Math.floor(z)
  const fx = x - x0
  const fy = y - y0
  const fz = z - z0
  const u = fade(fx)
  const v = fade(fy)
  const w = fade(fz)
  const xi = x0 | 0
  const yi = y0 | 0
  const zi = z0 | 0
  const n = (x1: number, y1: number, z1: number, a: number, b: number, c: number) =>
    grad3(hashInt3(xi + x1, yi + y1, zi + z1), fx - a, fy - b, fz - c)
  const x00 = lerp(n(0, 0, 0, 0, 0, 0), n(1, 0, 0, 1, 0, 0), u)
  const x10 = lerp(n(0, 1, 0, 0, 1, 0), n(1, 1, 0, 1, 1, 0), u)
  const x01 = lerp(n(0, 0, 1, 0, 0, 1), n(1, 0, 1, 1, 0, 1), u)
  const x11 = lerp(n(0, 1, 1, 0, 1, 1), n(1, 1, 1, 1, 1, 1), u)
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w)
}

function perlin4(x: number, y: number, z: number, w: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const z0 = Math.floor(z)
  const w0 = Math.floor(w)
  const fx = x - x0
  const fy = y - y0
  const fz = z - z0
  const fw = w - w0
  const u = fade(fx)
  const v = fade(fy)
  const t = fade(fz)
  const s = fade(fw)
  const xi = x0 | 0
  const yi = y0 | 0
  const zi = z0 | 0
  const wi = w0 | 0
  const g = (ox: number, oy: number, oz: number, ow: number) =>
    grad4(hashInt4(xi + ox, yi + oy, zi + oz, wi + ow), fx - ox, fy - oy, fz - oz, fw - ow)
  const tri = (ow: number) => {
    const x00 = lerp(g(0, 0, 0, ow), g(1, 0, 0, ow), u)
    const x10 = lerp(g(0, 1, 0, ow), g(1, 1, 0, ow), u)
    const x01 = lerp(g(0, 0, 1, ow), g(1, 0, 1, ow), u)
    const x11 = lerp(g(0, 1, 1, ow), g(1, 1, 1, ow), u)
    return lerp(lerp(x00, x10, v), lerp(x01, x11, v), t)
  }
  return lerp(tri(0), tri(1), s)
}

function snoise1(p: number): number {
  return 0.25 * perlin1(wrap(p))
}
function snoise2(x: number, y: number): number {
  return 0.6616 * perlin2(wrap(x), wrap(y))
}
function snoise3(x: number, y: number, z: number): number {
  return 0.982 * perlin3(wrap(x), wrap(y), wrap(z))
}
function snoise4(x: number, y: number, z: number, w: number): number {
  return 0.8344 * perlin4(wrap(x), wrap(y), wrap(z), wrap(w))
}

type Vec = [number, number, number, number]

function snoise(dim: Dim, p: Vec): number {
  if (dim === 1) return snoise1(p[0])
  if (dim === 2) return snoise2(p[0], p[1])
  if (dim === 3) return snoise3(p[0], p[1], p[2])
  return snoise4(p[0], p[1], p[2], p[3])
}

function scaleBy(dim: Dim, p: Vec, k: number): Vec {
  return [p[0] * k, dim > 1 ? p[1] * k : 0, dim > 2 ? p[2] * k : 0, dim > 3 ? p[3] * k : 0]
}

function fbm(dim: Dim, p: Vec, detail: number, roughness: number, lacunarity: number, normalize: boolean): number {
  let freq = 1
  let amp = 1
  let maxAmp = 0
  let sum = 0
  const n = Math.floor(detail)
  for (let i = 0; i <= n; i++) {
    sum += snoise(dim, scaleBy(dim, p, freq)) * amp
    maxAmp += amp
    amp *= roughness
    freq *= lacunarity
  }
  const rmd = detail - n
  if (rmd !== 0) {
    const sum2 = sum + snoise(dim, scaleBy(dim, p, freq)) * amp
    return normalize
      ? lerp(0.5 * sum / maxAmp + 0.5, 0.5 * sum2 / (maxAmp + amp) + 0.5, rmd)
      : lerp(sum, sum2, rmd)
  }
  return normalize ? 0.5 * sum / maxAmp + 0.5 : sum
}

function multi(dim: Dim, p0: Vec, detail: number, roughness: number, lacunarity: number): number {
  let p = p0
  let value = 1
  let pwr = 1
  const n = Math.floor(detail)
  for (let i = 0; i <= n; i++) {
    value *= pwr * snoise(dim, p) + 1
    pwr *= roughness
    p = scaleBy(dim, p, lacunarity)
  }
  const rmd = detail - n
  if (rmd !== 0) value *= rmd * pwr * snoise(dim, p) + 1
  return value
}

function hetero(dim: Dim, p0: Vec, detail: number, roughness: number, lacunarity: number, offset: number): number {
  let p = p0
  let pwr = roughness
  let value = offset + snoise(dim, p)
  p = scaleBy(dim, p, lacunarity)
  const n = Math.floor(detail)
  for (let i = 1; i <= n; i++) {
    value += (snoise(dim, p) + offset) * pwr * value
    pwr *= roughness
    p = scaleBy(dim, p, lacunarity)
  }
  const rmd = detail - n
  if (rmd !== 0) value += rmd * (snoise(dim, p) + offset) * pwr * value
  return value
}

function hybrid(dim: Dim, p0: Vec, detail: number, roughness: number, lacunarity: number, offset: number, gain: number): number {
  let p = p0
  let pwr = 1
  let value = 0
  let weight = 1
  const n = Math.floor(detail)
  for (let i = 0; weight > 0.001 && i <= n; i++) {
    if (weight > 1) weight = 1
    const signal = (snoise(dim, p) + offset) * pwr
    pwr *= roughness
    value += weight * signal
    weight *= gain * signal
    p = scaleBy(dim, p, lacunarity)
  }
  const rmd = detail - n
  if (rmd !== 0 && weight > 0.001) {
    if (weight > 1) weight = 1
    value += rmd * weight * (snoise(dim, p) + offset) * pwr
  }
  return value
}

function ridged(dim: Dim, p0: Vec, detail: number, roughness: number, lacunarity: number, offset: number, gain: number): number {
  let p = p0
  let pwr = roughness
  let signal = offset - Math.abs(snoise(dim, p))
  signal *= signal
  let value = signal
  const n = Math.floor(detail)
  for (let i = 1; i <= n; i++) {
    p = scaleBy(dim, p, lacunarity)
    const weight = Math.min(1, Math.max(0, signal * gain))
    signal = offset - Math.abs(snoise(dim, p))
    signal *= signal
    signal *= weight
    value += signal * pwr
    pwr *= roughness
  }
  return value
}

function fractal(dim: Dim, p: Vec, params: NoiseParams): number {
  const { noiseType, detail, roughness, lacunarity, offset, gain, normalize } = params
  if (noiseType === "MULTIFRACTAL") return multi(dim, p, detail, roughness, lacunarity)
  if (noiseType === "HETERO_TERRAIN") return hetero(dim, p, detail, roughness, lacunarity, offset)
  if (noiseType === "HYBRID_MULTIFRACTAL") return hybrid(dim, p, detail, roughness, lacunarity, offset, gain)
  if (noiseType === "RIDGED_MULTIFRACTAL") return ridged(dim, p, detail, roughness, lacunarity, offset, gain)
  return fbm(dim, p, detail, roughness, lacunarity, normalize)
}

function vecOffset(dim: Dim, seed: number): Vec {
  if (dim === 1) {
    return [100 + hashFloatToFloat(seed) * 100, 0, 0, 0]
  }
  const n = dim
  const out: Vec = [0, 0, 0, 0]
  for (let i = 0; i < n; i++) out[i] = 100 + hashVec2ToFloat(seed, i) * 100
  return out
}

const OFFSETS: Record<Dim, Vec[]> = {
  1: [0, 1, 2, 3, 4, 5].map((s) => vecOffset(1, s)),
  2: [0, 1, 2, 3, 4, 5].map((s) => vecOffset(2, s)),
  3: [0, 1, 2, 3, 4, 5].map((s) => vecOffset(3, s)),
  4: [0, 1, 2, 3, 4, 5].map((s) => vecOffset(4, s)),
}

function add(dim: Dim, p: Vec, o: Vec): Vec {
  return [p[0] + o[0], dim > 1 ? p[1] + o[1] : 0, dim > 2 ? p[2] + o[2] : 0, dim > 3 ? p[3] + o[3] : 0]
}

function distort(dim: Dim, p: Vec, distortion: number): Vec {
  if (distortion === 0) return p
  const out: Vec = [p[0], p[1], p[2], p[3]]
  const offs = OFFSETS[dim]
  for (let i = 0; i < dim; i++) {
    const shift = offs[i] ?? ([0, 0, 0, 0] as Vec)
    out[i] = (out[i] ?? 0) + snoise(dim, add(dim, p, shift)) * distortion
  }
  return out
}

function noiseColor(params: NoiseParams, u: number, v: number): [number, number, number] {
  const dim = params.dimensions
  const w = params.w
  const base: Vec =
    dim === 1
      ? [(w + u) * params.scale, 0, 0, 0]
      : dim === 2
        ? [u * params.scale, v * params.scale, 0, 0]
        : dim === 3
          ? [u * params.scale, v * params.scale, 0, 0]
          : [u * params.scale, v * params.scale, 0, w * params.scale]
  const p = distort(dim, base, params.distortion)
  const offs = OFFSETS[dim]
  return [
    fractal(dim, p, params),
    fractal(dim, add(dim, p, offs[dim]!), params),
    fractal(dim, add(dim, p, offs[dim + 1]!), params),
  ]
}

function smoothstep(x: number): number {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

function jitter(dim: Dim, cx: number, cy: number, cz: number, cw: number, randomness: number): Vec {
  if (dim === 1) return [hashFloatToFloat(cx) * randomness, 0, 0, 0]
  if (dim === 2) {
    const h = hashInt2ToVec2(cx, cy)
    return [h[0] * randomness, h[1] * randomness, 0, 0]
  }
  if (dim === 3) {
    const h = hashInt3ToVec3(cx, cy, cz)
    return [h[0] * randomness, h[1] * randomness, h[2] * randomness, 0]
  }
  const h = hashInt4ToVec4(cx, cy, cz, cw)
  return [h[0] * randomness, h[1] * randomness, h[2] * randomness, h[3] * randomness]
}

function cellColor(dim: Dim, cx: number, cy: number, cz: number, cw: number): [number, number, number] {
  if (dim === 1) return hashFloatToVec3(cx)
  if (dim === 2) return hashInt2ToVec3(cx, cy)
  if (dim === 3) return hashInt3ToVec3(cx, cy, cz)
  return hashInt4ToVec3(cx, cy, cz, cw)
}

const METRIC: Record<VoronoiMetric, number> = { EUCLIDEAN: 0, MANHATTAN: 1, CHEBYCHEV: 2, MINKOWSKI: 3 }

function metricDistance(dim: Dim, dx: number, dy: number, dz: number, dw: number, metric: number, exponent: number): number {
  const ax = Math.abs(dx)
  const ay = dim > 1 ? Math.abs(dy) : 0
  const az = dim > 2 ? Math.abs(dz) : 0
  const aw = dim > 3 ? Math.abs(dw) : 0
  if (metric === 1) return ax + ay + az + aw
  if (metric === 2) return Math.max(ax, ay, az, aw)
  if (metric === 3) {
    const e = exponent === 0 ? 1e-6 : exponent
    return Math.pow(Math.pow(ax, e) + Math.pow(ay, e) + Math.pow(az, e) + Math.pow(aw, e), 1 / e)
  }
  return Math.sqrt(dx * dx + dy * dy + dz * dz + dw * dw)
}

function forCells(dim: Dim, radius: number, body: (ox: number, oy: number, oz: number, ow: number) => void) {
  const span = radius * 2 + 1
  const total = span ** dim
  for (let n = 0; n < total; n++) {
    let x = n
    const o = [0, 0, 0, 0]
    for (let d = 0; d < dim; d++) {
      o[d] = (x % span) - radius
      x = Math.floor(x / span)
    }
    body(o[0]!, o[1]!, o[2]!, o[3]!)
  }
}

type VoronoiHit = { scalar: number; color: [number, number, number] }

function voronoiOnce(coord: Vec, params: VoronoiParams): VoronoiHit {
  const dim = params.dimensions
  const cell = [Math.floor(coord[0]), Math.floor(coord[1]), Math.floor(coord[2]), Math.floor(coord[3])]
  const local: Vec = [
    coord[0] - cell[0]!,
    coord[1] - cell[1]!,
    coord[2] - cell[2]!,
    coord[3] - cell[3]!,
  ]
  const metric = METRIC[params.metric]
  const feature = params.smoothness < 1e-5 && params.feature === "SMOOTH_F1" ? "F1" : params.feature

  if (feature === "DISTANCE_TO_EDGE") {
    if (dim === 1) {
      const mid = hashFloatToFloat(cell[0]!) * params.randomness
      const left = -1 + hashFloatToFloat(cell[0]! - 1) * params.randomness
      const right = 1 + hashFloatToFloat(cell[0]! + 1) * params.randomness
      const d = Math.min(Math.abs((mid + left) / 2 - local[0]), Math.abs((mid + right) / 2 - local[0]))
      return { scalar: d, color: [d, d, d] }
    }
    let min2 = Infinity
    let cx = 0
    let cy = 0
    let cz = 0
    let cw = 0
    forCells(dim, 1, (ox, oy, oz, ow) => {
      const j = jitter(dim, (cell[0]! + ox) | 0, (cell[1]! + oy) | 0, (cell[2]! + oz) | 0, (cell[3]! + ow) | 0, params.randomness)
      const vx = ox + j[0] - local[0]
      const vy = oy + j[1] - local[1]
      const vz = oz + j[2] - local[2]
      const vw = ow + j[3] - local[3]
      const d2 = vx * vx + vy * vy + vz * vz + vw * vw
      if (d2 < min2) {
        min2 = d2
        cx = vx
        cy = vy
        cz = vz
        cw = vw
      }
    })
    let edge = Infinity
    forCells(dim, 1, (ox, oy, oz, ow) => {
      const j = jitter(dim, (cell[0]! + ox) | 0, (cell[1]! + oy) | 0, (cell[2]! + oz) | 0, (cell[3]! + ow) | 0, params.randomness)
      const vx = ox + j[0] - local[0]
      const vy = oy + j[1] - local[1]
      const vz = oz + j[2] - local[2]
      const vw = ow + j[3] - local[3]
      const px = vx - cx
      const py = vy - cy
      const pz = vz - cz
      const pw = vw - cw
      const plen = px * px + py * py + pz * pz + pw * pw
      if (plen > 0.0001) {
        const inv = 1 / Math.sqrt(plen)
        const dist = ((cx + vx) * px + (cy + vy) * py + (cz + vz) * pz + (cw + vw) * pw) * 0.5 * inv
        if (dist < edge) edge = dist
      }
    })
    const shown = Number.isFinite(edge) ? Math.max(0, edge) : 0
    return { scalar: shown, color: [shown, shown, shown] }
  }

  if (feature === "N_SPHERE_RADIUS") {
    let min = Infinity
    let px = 0
    let py = 0
    let pz = 0
    let pw = 0
    let ox0 = 0
    let oy0 = 0
    let oz0 = 0
    let ow0 = 0
    forCells(dim, 1, (ox, oy, oz, ow) => {
      const j = jitter(dim, (cell[0]! + ox) | 0, (cell[1]! + oy) | 0, (cell[2]! + oz) | 0, (cell[3]! + ow) | 0, params.randomness)
      const qx = ox + j[0]
      const qy = oy + j[1]
      const qz = oz + j[2]
      const qw = ow + j[3]
      const d = metricDistance(dim, qx - local[0], qy - local[1], qz - local[2], qw - local[3], 0, 1)
      if (d < min) {
        min = d
        px = qx
        py = qy
        pz = qz
        pw = qw
        ox0 = ox
        oy0 = oy
        oz0 = oz
        ow0 = ow
      }
    })
    let min2 = Infinity
    forCells(dim, 1, (ox, oy, oz, ow) => {
      if (ox === 0 && oy === 0 && oz === 0 && ow === 0) return
      const j = jitter(
        dim,
        (cell[0]! + ox + ox0) | 0,
        (cell[1]! + oy + oy0) | 0,
        (cell[2]! + oz + oz0) | 0,
        (cell[3]! + ow + ow0) | 0,
        params.randomness,
      )
      const qx = ox + ox0 + j[0]
      const qy = oy + oy0 + j[1]
      const qz = oz + oz0 + j[2]
      const qw = ow + ow0 + j[3]
      const d = metricDistance(dim, px - qx, py - qy, pz - qz, pw - qw, 0, 1)
      if (d < min2) min2 = d
    })
    const radius = (Number.isFinite(min2) ? min2 : 0) / 2
    return { scalar: radius, color: [radius, radius, radius] }
  }

  const radius = feature === "SMOOTH_F1" ? 2 : 1
  if (feature === "SMOOTH_F1") {
    let smoothDistance = 0
    let cr = 0
    let cg = 0
    let cb = 0
    let h = -1
    forCells(dim, radius, (ox, oy, oz, ow) => {
      const ix = (cell[0]! + ox) | 0
      const iy = (cell[1]! + oy) | 0
      const iz = (cell[2]! + oz) | 0
      const iw = (cell[3]! + ow) | 0
      const j = jitter(dim, ix, iy, iz, iw, params.randomness)
      const d = metricDistance(dim, ox + j[0] - local[0], oy + j[1] - local[1], oz + j[2] - local[2], ow + j[3] - local[3], metric, params.exponent)
      h = h === -1 ? 1 : smoothstep(0.5 + 0.5 * (smoothDistance - d) / params.smoothness)
      let correction = params.smoothness * h * (1 - h)
      smoothDistance = lerp(smoothDistance, d, h) - correction
      correction /= 1 + 3 * params.smoothness
      const color = cellColor(dim, ix, iy, iz, iw)
      cr = lerp(cr, color[0], h) - correction
      cg = lerp(cg, color[1], h) - correction
      cb = lerp(cb, color[2], h) - correction
    })
    return { scalar: smoothDistance, color: [cr, cg, cb] }
  }

  let first = Infinity
  let second = Infinity
  let cx = 0
  let cy = 0
  let cz = 0
  let cw = 0
  let c2x = 0
  let c2y = 0
  let c2z = 0
  let c2w = 0
  forCells(dim, 1, (ox, oy, oz, ow) => {
    const ix = (cell[0]! + ox) | 0
    const iy = (cell[1]! + oy) | 0
    const iz = (cell[2]! + oz) | 0
    const iw = (cell[3]! + ow) | 0
    const j = jitter(dim, ix, iy, iz, iw, params.randomness)
    const d = metricDistance(dim, ox + j[0] - local[0], oy + j[1] - local[1], oz + j[2] - local[2], ow + j[3] - local[3], metric, params.exponent)
    if (d < first) {
      second = first
      c2x = cx
      c2y = cy
      c2z = cz
      c2w = cw
      first = d
      cx = ix
      cy = iy
      cz = iz
      cw = iw
    } else if (d < second) {
      second = d
      c2x = ix
      c2y = iy
      c2z = iz
      c2w = iw
    }
  })
  if (feature === "F2") return { scalar: second, color: cellColor(dim, c2x, c2y, c2z, c2w) }
  return { scalar: first, color: cellColor(dim, cx, cy, cz, cw) }
}

function maxDistance(params: VoronoiParams): number {
  const h = 0.5 + 0.5 * params.randomness
  if (params.feature === "DISTANCE_TO_EDGE" || params.dimensions === 1) {
    const base = params.feature === "F2" ? h * 2 : h
    return base
  }
  const metric = METRIC[params.metric]
  const d = metricDistance(params.dimensions, h, h, h, h, metric, params.exponent)
  return params.feature === "F2" ? d * 2 : d
}

function voronoiColor(params: VoronoiParams, u: number, v: number): [number, number, number] {
  const dim = params.dimensions
  const w = params.w
  let coord: Vec =
    dim === 1
      ? [(w + u) * params.scale, 0, 0, 0]
      : dim === 2
        ? [u * params.scale, v * params.scale, 0, 0]
        : dim === 3
          ? [u * params.scale, v * params.scale, 0, 0]
          : [u * params.scale, v * params.scale, 0, w * params.scale]
  const n = Math.floor(params.detail)
  const rmd = params.detail - n
  let amp = 1
  let weight = 0
  let dist = 0
  let cr = 0
  let cg = 0
  let cb = 0
  const accumulate = (sample: VoronoiHit, a: number) => {
    dist += sample.scalar * a
    cr += sample.color[0] * a
    cg += sample.color[1] * a
    cb += sample.color[2] * a
    weight += a
  }
  for (let i = 0; i <= n; i++) {
    accumulate(voronoiOnce(coord, params), amp)
    amp *= params.roughness
    coord = scaleBy(dim, coord, params.lacunarity)
  }
  if (rmd !== 0) accumulate(voronoiOnce(coord, params), amp * rmd)
  if (weight === 0) return [0, 0, 0]
  const colorFeature = params.feature === "F1" || params.feature === "F2" || params.feature === "SMOOTH_F1"
  if (colorFeature) return [cr / weight, cg / weight, cb / weight]
  let scalar = dist / weight
  if (params.normalize) {
    const maxD = maxDistance(params)
    if (maxD > 0) scalar /= maxD
  }
  const gain = params.feature === "DISTANCE_TO_EDGE" ? 6 : 2
  const shown = Math.min(1, Math.max(0, scalar * gain))
  return [shown, shown, shown]
}

function sample(params: PreviewParams, u: number, v: number): [number, number, number] {
  return params.kind === "noise" ? noiseColor(params, u, v) : voronoiColor(params, u, v)
}

const cache = new Map<string, Uint8ClampedArray>()

function render(params: PreviewParams, size: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4)
  let pixel = 0
  for (let y = 0; y < size; y++) {
    const v = 1 - (y + 0.5) / size
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const [r, g, b] = sample(params, u, v)
      const o = pixel * 4
      data[o] = Math.round(linearToSrgb(r) * 255)
      data[o + 1] = Math.round(linearToSrgb(g) * 255)
      data[o + 2] = Math.round(linearToSrgb(b) * 255)
      data[o + 3] = 255
      pixel++
    }
  }
  return data
}

export function paintTexturePreview(node: NoodleBinNode, data: Uint8ClampedArray, size: number): boolean {
  const params = readParams(node)
  if (!params || size < 2 || data.length < size * size * 4) return false
  const key = `${texturePreviewKey(node)}@${size}`
  let cached = cache.get(key)
  if (!cached) {
    cached = render(params, size)
    if (cache.size > 24) cache.clear()
    cache.set(key, cached)
  }
  data.set(cached)
  return true
}
