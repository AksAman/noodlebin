/**
 * Types for a versioned node catalog.
 * Source of truth: docs/pid/06-node-catalog.md.
 */

import type { BlenderVersion, JsonValue, NodeSocket, TreeType } from "@noodlebin/interchange"

export type ThemeSource = "factory" | "binary" | "source"

export type WidgetId =
  | "color_ramp"
  | "curve_mapping"
  | "image"
  | "frame"
  | "reroute"
  | "group"
  | "zone"
  | "generic"

export type PropertyType = "FLOAT" | "INT" | "BOOLEAN" | "ENUM" | "STRING" | "FLOAT_ARRAY" | "POINTER"

export interface CatalogEnumItem {
  identifier: string
  name: string
}

export interface CatalogProperty {
  identifier: string
  type: PropertyType | string
  default?: JsonValue
  enum_items?: CatalogEnumItem[]
  min?: number
  max?: number
  soft_min?: number
  soft_max?: number
  step?: number
  precision?: number
  affects_sockets: boolean
  array_length?: number
}

export interface CatalogCategory {
  tree_type: TreeType | string
  id: string
  label: string
  nodes: string[]
}

export interface CatalogSkipped {
  bl_idname: string
  error: string
}

export interface CatalogNode {
  bl_idname: string
  label: string
  description: string
  tree_types: string[]
  category_id: string | null
  header_color: string
  width_default: number
  inputs: NodeSocket[]
  outputs: NodeSocket[]
  properties: CatalogProperty[]
  widget: WidgetId | string
  auto_creates_pair?: string
  pair_property?: string
}

export interface Catalog {
  blender_version: BlenderVersion
  blender_version_string: string
  extracted_at: string
  theme_source?: ThemeSource | string
  themes: Record<string, number[]>
  socket_colors: Record<string, number[]>
  socket_colors_unresolved?: string[]
  categories: CatalogCategory[]
  nodes: Record<string, CatalogNode>
  skipped: CatalogSkipped[]
}

/** PID: missing theme key. */
export const MISSING_THEME_HEADER: readonly [number, number, number] = [0.25, 0.25, 0.25]

/** PID: no catalog, or no entry for this bl_idname. */
export const UNKNOWN_NODE_HEADER: readonly [number, number, number] = [0.2, 0.2, 0.2]

/** Same gray the extractor writes when a socket color cannot be resolved. */
export const UNRESOLVED_SOCKET_COLOR: readonly [number, number, number] = [0.63, 0.63, 0.63]
