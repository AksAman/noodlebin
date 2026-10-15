/**
 * Read catalog/versions/<dir>/catalog.json from disk.
 * The web app will import JSON at build time; tests and scripts use this.
 */

import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { Catalog } from "./types"
import { indexCatalogs, type CatalogIndex } from "./resolve"

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
    throw new Error(`Not a NodeVault catalog: ${path}`)
  }
  return value
}

/** Load every catalog.json one level under `versionsDir`. Missing dirs yield an empty index. */
export async function loadCatalogDirectory(versionsDir: string): Promise<CatalogIndex> {
  let entries: string[]
  try {
    entries = await readdir(versionsDir)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === "ENOENT") return indexCatalogs([])
    throw err
  }
  const catalogs: Catalog[] = []
  for (const name of entries) {
    const path = join(versionsDir, name, "catalog.json")
    let text: string
    try {
      text = await readFile(path, "utf8")
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === "ENOENT" || code === "ENOTDIR") continue
      throw err
    }
    catalogs.push(parseCatalogJson(text, path))
  }
  return indexCatalogs(catalogs)
}
