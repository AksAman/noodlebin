/** Linear RGB as Blender stores scene colors (ramps, node.color) → CSS sRGB. */

export function linearToSrgb(c: number): number {
  const x = Math.min(1, Math.max(0, c))
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

function cssFrom(channels: readonly number[], map: (c: number) => number): string {
  const r = Math.round(map(channels[0] ?? 0) * 255)
  const g = Math.round(map(channels[1] ?? 0) * 255)
  const b = Math.round(map(channels[2] ?? 0) * 255)
  if (channels.length >= 4) {
    return `rgba(${r}, ${g}, ${b}, ${channels[3]})`
  }
  return `rgb(${r}, ${g}, ${b})`
}

export function cssColor(linear: readonly number[]): string {
  return cssFrom(linear, (c) => linearToSrgb(Math.min(1, Math.max(0, c))))
}

/**
 * Theme and socket_draw colors from the catalog. Blender's theme RNA is already
 * the color painted in the node editor; applying the sRGB curve washes headers
 * to pastel.
 */
export function cssThemeColor(channels: readonly number[]): string {
  return cssFrom(channels, (c) => Math.min(1, Math.max(0, c)))
}
