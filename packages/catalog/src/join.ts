/**
 * How the visualizer joins catalog and payload. Colors and the node record
 * live here so the graph view does not hardcode fallbacks.
 */

import type { NodeVaultNode } from "@nodevault/interchange"
import {
  MISSING_THEME_HEADER,
  UNKNOWN_NODE_HEADER,
  UNRESOLVED_SOCKET_COLOR,
  type Catalog,
  type CatalogNode,
} from "./types"

export function lookupNode(catalog: Catalog | null, bl_idname: string): CatalogNode | null {
  if (catalog === null) return null
  return catalog.nodes[bl_idname] ?? null
}

/** Linear RGB(A) for a node's header. */
export function headerColor(catalog: Catalog | null, bl_idname: string): number[] {
  const rec = lookupNode(catalog, bl_idname)
  if (catalog === null || rec === null) return [...UNKNOWN_NODE_HEADER]
  const color = catalog.themes[rec.header_color]
  if (!color || color.length < 3) return [...MISSING_THEME_HEADER]
  return color
}

/** Linear RGB(A) for a socket circle. */
export function socketColor(catalog: Catalog | null, socket_bl_idname: string): number[] {
  if (catalog === null) return [...UNRESOLVED_SOCKET_COLOR]
  const color = catalog.socket_colors[socket_bl_idname]
  if (!color || color.length < 3) return [...UNRESOLVED_SOCKET_COLOR]
  return color
}

/**
 * Widget id the generic view branches on. Unknown strings stay as-is; the
 * visualizer treats anything it does not know as generic.
 */
export function widgetId(catalog: Catalog | null, node: NodeVaultNode): string {
  if (node.bl_idname === "NodeFrame") return "frame"
  if (node.bl_idname === "NodeReroute") return "reroute"
  if (node.group_tree_id) return "group"
  const rec = lookupNode(catalog, node.bl_idname)
  if (rec === null) return "generic"
  return rec.widget
}
