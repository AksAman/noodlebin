/** Jenkins lookup3 and PCG hashes, matching Blender's integer and float hashes. */

const bits = new ArrayBuffer(4)
const f32 = new Float32Array(bits)
const u32b = new Uint32Array(bits)

function u32(n: number): number {
  return n >>> 0
}

function rot(x: number, k: number): number {
  return u32((x << k) | (x >>> (32 - k)))
}

function mix(a: number, b: number, c: number): [number, number, number] {
  a = u32(a - c)
  a = u32(a ^ rot(c, 4))
  c = u32(c + b)
  b = u32(b - a)
  b = u32(b ^ rot(a, 6))
  a = u32(a + c)
  c = u32(c - b)
  c = u32(c ^ rot(b, 8))
  b = u32(b + a)
  a = u32(a - c)
  a = u32(a ^ rot(c, 16))
  c = u32(c + b)
  b = u32(b - a)
  b = u32(b ^ rot(a, 19))
  a = u32(a + c)
  c = u32(c - b)
  c = u32(c ^ rot(b, 4))
  b = u32(b + a)
  return [a, b, c]
}

function final(a: number, b: number, c: number): [number, number, number] {
  c = u32(c ^ b)
  c = u32(c - rot(b, 14))
  a = u32(a ^ c)
  a = u32(a - rot(c, 11))
  b = u32(b ^ a)
  b = u32(b - rot(a, 25))
  c = u32(c ^ b)
  c = u32(c - rot(b, 16))
  a = u32(a ^ c)
  a = u32(a - rot(c, 4))
  b = u32(b ^ a)
  b = u32(b - rot(a, 14))
  c = u32(c ^ b)
  c = u32(c - rot(b, 24))
  return [a, b, c]
}

function seed(count: number): number {
  return u32(0xdeadbeef + (count << 2) + 13)
}

export function hashUint(kx: number): number {
  const s = seed(1)
  const a = u32(s + u32(kx))
  return final(a, s, s)[2]
}

export function hashUint2(kx: number, ky: number): number {
  const s = seed(2)
  return final(u32(s + u32(kx)), u32(s + u32(ky)), s)[2]
}

export function hashUint3(kx: number, ky: number, kz: number): number {
  const s = seed(3)
  return final(u32(s + u32(kx)), u32(s + u32(ky)), u32(s + u32(kz)))[2]
}

export function hashUint4(kx: number, ky: number, kz: number, kw: number): number {
  const s = seed(4)
  let a = u32(s + u32(kx))
  let b = u32(s + u32(ky))
  let c = u32(s + u32(kz))
  ;[a, b, c] = mix(a, b, c)
  a = u32(a + u32(kw))
  return final(a, b, c)[2]
}

function asInt(n: number): number {
  return n | 0
}

export function hashInt(k: number): number {
  return hashUint(asInt(k) >>> 0)
}

export function hashInt2(x: number, y: number): number {
  return hashUint2(asInt(x) >>> 0, asInt(y) >>> 0)
}

export function hashInt3(x: number, y: number, z: number): number {
  return hashUint3(asInt(x) >>> 0, asInt(y) >>> 0, asInt(z) >>> 0)
}

export function hashInt4(x: number, y: number, z: number, w: number): number {
  return hashUint4(asInt(x) >>> 0, asInt(y) >>> 0, asInt(z) >>> 0, asInt(w) >>> 0)
}

export function floatBitsToUint(x: number): number {
  f32[0] = x
  return u32b[0]!
}

function u32ToF32(u: number): number {
  f32[0] = u
  return f32[0]!
}

function unit(u: number): number {
  return u32ToF32(u) / u32ToF32(0xffffffff)
}

export function hashFloatToFloat(k: number): number {
  return unit(hashUint(floatBitsToUint(k)))
}

export function hashVec2ToFloat(x: number, y: number): number {
  return unit(hashUint2(floatBitsToUint(x), floatBitsToUint(y)))
}

export function hashFloatToVec3(k: number): [number, number, number] {
  return [hashFloatToFloat(k), hashVec2ToFloat(k, 1), hashVec2ToFloat(k, 2)]
}

const PCG_MUL = 1664525
const PCG_ADD = 1013904223
const PCG_SCALE = 1 / 0x7fffffff

function pcgUnit(h: number): number {
  return (h & 0x7fffffff) * PCG_SCALE
}

function pcg2(x: number, y: number): [number, number] {
  let vx = (Math.imul(x, PCG_MUL) + PCG_ADD) | 0
  let vy = (Math.imul(y, PCG_MUL) + PCG_ADD) | 0
  vx = (vx + Math.imul(vy, PCG_MUL)) | 0
  vy = (vy + Math.imul(vx, PCG_MUL)) | 0
  vx ^= vx >> 16
  vy ^= vy >> 16
  vx = (vx + Math.imul(vy, PCG_MUL)) | 0
  vy = (vy + Math.imul(vx, PCG_MUL)) | 0
  return [vx, vy]
}

function pcg3(x: number, y: number, z: number): [number, number, number] {
  let vx = (Math.imul(x, PCG_MUL) + PCG_ADD) | 0
  let vy = (Math.imul(y, PCG_MUL) + PCG_ADD) | 0
  let vz = (Math.imul(z, PCG_MUL) + PCG_ADD) | 0
  vx = (vx + Math.imul(vy, vz)) | 0
  vy = (vy + Math.imul(vz, vx)) | 0
  vz = (vz + Math.imul(vx, vy)) | 0
  vx ^= vx >> 16
  vy ^= vy >> 16
  vz ^= vz >> 16
  vx = (vx + Math.imul(vy, vz)) | 0
  vy = (vy + Math.imul(vz, vx)) | 0
  vz = (vz + Math.imul(vx, vy)) | 0
  return [vx, vy, vz]
}

function pcg4(x: number, y: number, z: number, w: number): [number, number, number, number] {
  let vx = (Math.imul(x, PCG_MUL) + PCG_ADD) | 0
  let vy = (Math.imul(y, PCG_MUL) + PCG_ADD) | 0
  let vz = (Math.imul(z, PCG_MUL) + PCG_ADD) | 0
  let vw = (Math.imul(w, PCG_MUL) + PCG_ADD) | 0
  vx = (vx + Math.imul(vy, vw)) | 0
  vy = (vy + Math.imul(vz, vx)) | 0
  vz = (vz + Math.imul(vx, vy)) | 0
  vw = (vw + Math.imul(vy, vz)) | 0
  vx ^= vx >> 16
  vy ^= vy >> 16
  vz ^= vz >> 16
  vw ^= vw >> 16
  vx = (vx + Math.imul(vy, vw)) | 0
  vy = (vy + Math.imul(vz, vx)) | 0
  vz = (vz + Math.imul(vx, vy)) | 0
  vw = (vw + Math.imul(vy, vz)) | 0
  return [vx, vy, vz, vw]
}

export function hashInt2ToVec2(x: number, y: number): [number, number] {
  const h = pcg2(x | 0, y | 0)
  return [pcgUnit(h[0]), pcgUnit(h[1])]
}

export function hashInt3ToVec3(x: number, y: number, z: number): [number, number, number] {
  const h = pcg3(x | 0, y | 0, z | 0)
  return [pcgUnit(h[0]), pcgUnit(h[1]), pcgUnit(h[2])]
}

export function hashInt2ToVec3(x: number, y: number): [number, number, number] {
  return hashInt3ToVec3(x, y, 0)
}

export function hashInt4ToVec3(x: number, y: number, z: number, w: number): [number, number, number] {
  const h = pcg4(x | 0, y | 0, z | 0, w | 0)
  return [pcgUnit(h[0]), pcgUnit(h[1]), pcgUnit(h[2])]
}

export function hashInt4ToVec4(x: number, y: number, z: number, w: number): [number, number, number, number] {
  const h = pcg4(x | 0, y | 0, z | 0, w | 0)
  return [pcgUnit(h[0]), pcgUnit(h[1]), pcgUnit(h[2]), pcgUnit(h[3])]
}
