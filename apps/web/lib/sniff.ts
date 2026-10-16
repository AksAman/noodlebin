const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG = [0xff, 0xd8, 0xff]
const GIF87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]
const GIF89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false
  return sig.every((b, i) => bytes[offset + i] === b)
}

export function sniffCover(bytes: Uint8Array): { type: string; ext: string } | null {
  if (startsWith(bytes, PNG)) return { type: "image/png", ext: "png" }
  if (startsWith(bytes, JPEG)) return { type: "image/jpeg", ext: "jpg" }
  if (startsWith(bytes, GIF87) || startsWith(bytes, GIF89)) return { type: "image/gif", ext: "gif" }
  if (
    bytes.length >= 12 &&
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { type: "image/webp", ext: "webp" }
  }
  return null
}

export function sniffMp4(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
}

export function sniffBlend(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return true
  return (
    bytes.length >= 7 &&
    bytes[0] === 0x42 &&
    bytes[1] === 0x4c &&
    bytes[2] === 0x45 &&
    bytes[3] === 0x4e &&
    bytes[4] === 0x44 &&
    bytes[5] === 0x45 &&
    bytes[6] === 0x52
  )
}
