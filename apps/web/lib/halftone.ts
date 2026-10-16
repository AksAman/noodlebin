import graph from "@/fixtures/handwritten/homepage-noise.nodevault.json"

type Socket = { identifier: string; default_value?: unknown }
type GraphNode = {
  bl_idname: string
  label: string
  sockets: { inputs: Socket[] }
  widgets: {
    color_ramp?: { elements: { position: number; color: number[] }[] }
  }
}

type Vec3 = [number, number, number]

/** Generated-coordinate units per second; the texture slides sideways instead of morphing, so it stays the one Blender renders. */
export const PAN_SPEED = 0.012

/** Pulls every constant out of the published graph, so the page renders exactly what pasting it into Blender renders. */
export function readGraph() {
  const nodes = graph.trees[0]!.nodes as unknown as GraphNode[]
  const find = (match: (n: GraphNode) => boolean) => {
    const node = nodes.find(match)
    if (!node) throw new Error("homepage graph is missing a node")
    return node
  }
  const value = (node: GraphNode, id: string) => node.sockets.inputs.find((s) => s.identifier === id)?.default_value
  const num = (node: GraphNode, id: string) => value(node, id) as number
  const vec3 = (node: GraphNode, id: string) => (value(node, id) as number[]).slice(0, 3) as Vec3
  const byLabel = (label: string) => find((n) => n.label === label)

  const noise = find((n) => n.bl_idname === "ShaderNodeTexNoise")
  const elements = find((n) => n.bl_idname === "ShaderNodeValToRGB").widgets.color_ramp!.elements
  const radius = byLabel("Dot radius")
  const dim = byLabel("Grid dim")
  const lit = byLabel("Lit")
  return {
    scale: num(noise, "Scale"),
    detail: num(noise, "Detail"),
    roughness: num(noise, "Roughness"),
    distortion: num(noise, "Distortion"),
    stops: elements.map((e) => e.position) as Vec3,
    colors: elements.map((e) => e.color.slice(0, 3)) as [Vec3, Vec3, Vec3],
    snap: vec3(byLabel("Snap to grid"), "Vector_001"),
    offset: vec3(byLabel("Cell center"), "Vector_001"),
    inCells: num(byLabel("In cells"), "Value_001"),
    maxLum: num(byLabel("Brightness"), "Value_001"),
    radius: [num(radius, "Value_001"), num(radius, "Value_002")] as const,
    dim: [num(dim, "Value_001"), num(dim, "Value_002")] as const,
    litRange: [num(lit, "From Min"), num(lit, "From Max")] as const,
    base: vec3(byLabel("Grid or glow"), "A_Color"),
  }
}

export const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))

/*
 * Blender's Noise Texture (3D, fBM, Normalize on) evaluated on Generated coordinates,
 * so the dots sample the same field Blender renders: Jenkins lookup3 hashing,
 * improved-Perlin gradients scaled by 0.982, hashed distortion offsets.
 * Expects uScale, uDetail, uRough, uDistort, uStops and uC0..uC2 to be declared first.
 */
export const HALFTONE_LIBRARY = `
uint rot(uint x, uint k) { return (x << k) | (x >> (32u - k)); }

void mixBits(inout uint a, inout uint b, inout uint c) {
  c ^= b; c -= rot(b, 14u);
  a ^= c; a -= rot(c, 11u);
  b ^= a; b -= rot(a, 25u);
  c ^= b; c -= rot(b, 16u);
  a ^= c; a -= rot(c, 4u);
  b ^= a; b -= rot(a, 14u);
  c ^= b; c -= rot(b, 24u);
}

uint hash2(uint kx, uint ky) {
  uint a = 0xdeadbeefu + (2u << 2u) + 13u;
  uint b = a;
  uint c = a;
  b += ky;
  a += kx;
  mixBits(a, b, c);
  return c;
}

uint hash3(uint kx, uint ky, uint kz) {
  uint a = 0xdeadbeefu + (3u << 2u) + 13u;
  uint b = a;
  uint c = a;
  c += kz;
  b += ky;
  a += kx;
  mixBits(a, b, c);
  return c;
}

float hashToFloat(vec2 k) {
  return float(hash2(floatBitsToUint(k.x), floatBitsToUint(k.y))) / float(0xFFFFFFFFu);
}

vec3 offset3(float seed) {
  return 100.0 + 100.0 * vec3(hashToFloat(vec2(seed, 0.0)), hashToFloat(vec2(seed, 1.0)), hashToFloat(vec2(seed, 2.0)));
}

float grad(uint hash, float x, float y, float z) {
  uint h = hash & 15u;
  float u = h < 8u ? x : y;
  float v = h < 4u ? y : ((h == 12u || h == 14u) ? x : z);
  return ((h & 1u) != 0u ? -u : u) + ((h & 2u) != 0u ? -v : v);
}

float fade(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

float perlin(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  uint X = uint(int(i.x));
  uint Y = uint(int(i.y));
  uint Z = uint(int(i.z));
  float u = fade(f.x);
  float v = fade(f.y);
  float w = fade(f.z);
  float x0 = mix(
    mix(grad(hash3(X, Y, Z), f.x, f.y, f.z), grad(hash3(X + 1u, Y, Z), f.x - 1.0, f.y, f.z), u),
    mix(grad(hash3(X, Y + 1u, Z), f.x, f.y - 1.0, f.z), grad(hash3(X + 1u, Y + 1u, Z), f.x - 1.0, f.y - 1.0, f.z), u),
    v);
  float x1 = mix(
    mix(grad(hash3(X, Y, Z + 1u), f.x, f.y, f.z - 1.0), grad(hash3(X + 1u, Y, Z + 1u), f.x - 1.0, f.y, f.z - 1.0), u),
    mix(grad(hash3(X, Y + 1u, Z + 1u), f.x, f.y - 1.0, f.z - 1.0), grad(hash3(X + 1u, Y + 1u, Z + 1u), f.x - 1.0, f.y - 1.0, f.z - 1.0), u),
    v);
  return 0.982 * mix(x0, x1, w);
}

float fbm(vec3 p) {
  float fscale = 1.0;
  float amp = 1.0;
  float maxamp = 0.0;
  float sum = 0.0;
  for (int i = 0; i <= int(uDetail); i++) {
    sum += perlin(fscale * p) * amp;
    maxamp += amp;
    amp *= uRough;
    fscale *= 2.0;
  }
  float rmd = uDetail - floor(uDetail);
  float whole = 0.5 * sum / maxamp + 0.5;
  if (rmd == 0.0) return whole;
  float sum2 = sum + perlin(fscale * p) * amp;
  return mix(whole, 0.5 * sum2 / (maxamp + amp) + 0.5, rmd);
}

float noiseTexture(vec3 co) {
  vec3 p = co * uScale;
  if (uDistort != 0.0) {
    p += vec3(perlin(p + offset3(0.0)), perlin(p + offset3(1.0)), perlin(p + offset3(2.0))) * uDistort;
  }
  return fbm(p);
}

float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 colorRamp(float f) {
  if (f <= uStops.x) return uC0;
  if (f < uStops.y) return mix(uC0, uC1, (f - uStops.x) / (uStops.y - uStops.x));
  if (f < uStops.z) return mix(uC1, uC2, (f - uStops.y) / (uStops.z - uStops.y));
  return uC2;
}

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
`

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n))
const v3 = (v: readonly number[]) => `vec3(${v.slice(0, 3).map(f).join(", ")})`
const v2 = (v: readonly number[]) => `vec2(${v.map(f).join(", ")})`

/**
 * The homepage graph as a Shadertoy-style cover: every constant baked in from the graph,
 * composited over black like a Cycles render of the plane with the Standard view transform.
 */
export function halftoneCoverSource(): string {
  const g = readGraph()
  return `// Generated from the homepage-background node graph. Every constant comes from a node.
const float uScale = ${f(g.scale)};
const float uDetail = ${f(g.detail)};
const float uRough = ${f(g.roughness)};
const float uDistort = ${f(g.distortion)};
const vec3 uStops = ${v3(g.stops)};
const vec3 uC0 = ${v3(g.colors[0])};
const vec3 uC1 = ${v3(g.colors[1])};
const vec3 uC2 = ${v3(g.colors[2])};
const vec3 uSnap = ${v3(g.snap)};
const vec3 uOffset = ${v3(g.offset)};
const float uInCells = ${f(g.inCells)};
const float uMaxLum = ${f(g.maxLum)};
const vec2 uRadius = ${v2(g.radius)};
const vec2 uDim = ${v2(g.dim)};
const vec2 uLitRange = ${v2(g.litRange)};
const vec3 uBase = ${v3(g.base)};
${HALFTONE_LIBRARY}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float plane = iResolution.y;
  vec3 co = vec3(fragCoord.x / plane + iTime * ${f(PAN_SPEED)}, fragCoord.y / plane, 0.5);
  vec3 center = floor(co / uSnap) * uSnap + uOffset;
  vec3 ramp = colorRamp(noiseTexture(center));
  float light = luminance(ramp) / uMaxLum;
  float radius = sqrt(max(light, 0.0)) * uRadius.x + uRadius.y;
  float dist = distance(co, center) * uInCells;
  float inside = clamp((radius - dist) * (plane / uInCells) + 0.5, 0.0, 1.0);
  float lit = smoothstep(uLitRange.x, uLitRange.y, light);
  vec3 color = mix(uBase, ramp, lit);
  float strength = (lit * uDim.x + uDim.y) * inside;
  fragColor = vec4(toSrgb(color * strength), 1.0);
}
`
}
