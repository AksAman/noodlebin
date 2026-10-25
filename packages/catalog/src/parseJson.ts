import type { Catalog } from "./types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isCatalog(value: unknown): value is Catalog {
  if (!isRecord(value)) return false
  const version = value["blender_version"]
  return (
    Array.isArray(version) &&
    version.length === 3 &&
    version.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0) &&
    typeof value["blender_version_string"] === "string" &&
    isRecord(value["themes"]) &&
    isRecord(value["socket_colors"]) &&
    isRecord(value["nodes"]) &&
    Array.isArray(value["categories"]) &&
    Array.isArray(value["skipped"])
  )
}

export function parseCatalogJson(text: string, path = "<catalog>"): Catalog {
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Invalid catalog JSON at ${path}: ${detail}`)
  }
  if (!isCatalog(value)) {
    throw new Error(`Not a NoodleBin catalog: ${path}`)
  }
  return value
}
