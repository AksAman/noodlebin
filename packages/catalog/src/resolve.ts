/**
 * Pick a catalog for a payload's Blender version.
 *
 * A payload's blender_version selects the directory. If the exact triple is
 * missing, pick the catalog with the same major and minor and the nearest
 * patch. If no catalog shares major.minor, the graph draws without one.
 */

import type { BlenderVersion } from "@nodevault/interchange"
import type { Catalog } from "./types"

export type CatalogMatch = "exact" | "nearest_patch" | "missing"

export interface CatalogResolution {
  match: CatalogMatch
  /** The catalog to draw with. Null when this Blender version has not been extracted. */
  catalog: Catalog | null
  requested: BlenderVersion
  /** The catalog's blender_version when one was chosen. */
  used: BlenderVersion | null
  used_string: string | null
  /**
   * One line for the paste-page top bar. Null when the match is exact
   * (nothing to disclose).
   */
  notice: string | null
}

export interface CatalogIndex {
  catalogs: Catalog[]
}

export function indexCatalogs(catalogs: readonly Catalog[]): CatalogIndex {
  const copy = [...catalogs].sort(compareCatalog)
  return { catalogs: copy }
}

function compareCatalog(a: Catalog, b: Catalog): number {
  const [am, an, ap] = a.blender_version
  const [bm, bn, bp] = b.blender_version
  return am - bm || an - bn || ap - bp || a.blender_version_string.localeCompare(b.blender_version_string)
}

export function sameVersion(a: BlenderVersion, b: BlenderVersion): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

function patchDistance(requested: BlenderVersion, catalog: Catalog): number {
  return Math.abs(catalog.blender_version[2] - requested[2])
}

/**
 * Resolve the catalog for `requested`. `catalogs` is the set shipped with the
 * app (every directory under catalog/versions).
 */
export function resolveCatalog(index: CatalogIndex, requested: BlenderVersion): CatalogResolution {
  const exact = index.catalogs.find((c) => sameVersion(c.blender_version, requested))
  if (exact) {
    return {
      match: "exact",
      catalog: exact,
      requested,
      used: exact.blender_version,
      used_string: exact.blender_version_string,
      notice: null,
    }
  }

  const sameMinor = index.catalogs.filter(
    (c) => c.blender_version[0] === requested[0] && c.blender_version[1] === requested[1],
  )
  if (sameMinor.length === 0) {
    return {
      match: "missing",
      catalog: null,
      requested,
      used: null,
      used_string: null,
      notice: `No catalog for Blender ${requested.join(".")}. This Blender version has not been extracted.`,
    }
  }

  sameMinor.sort((a, b) => {
    const da = patchDistance(requested, a)
    const db = patchDistance(requested, b)
    if (da !== db) return da - db
    return b.blender_version[2] - a.blender_version[2]
  })
  const nearest = sameMinor[0]!
  return {
    match: "nearest_patch",
    catalog: nearest,
    requested,
    used: nearest.blender_version,
    used_string: nearest.blender_version_string,
    notice: `Requested Blender ${requested.join(".")}; using catalog ${nearest.blender_version_string}.`,
  }
}
