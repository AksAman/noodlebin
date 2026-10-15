/**
 * Read catalog/versions/<dir>/catalog.json from disk.
 * Node-only. The web app parses JSON imported at build time.
 */

import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { Catalog } from "./types"
import { indexCatalogs, type CatalogIndex } from "./resolve"
import { parseCatalogJson } from "./parseJson"

export { parseCatalogJson }

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
