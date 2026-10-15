/**
 * Types for the `nodevault.tree` clipboard payload.
 * Source of truth: docs/pid/05-interchange-format.md.
 *
 * These describe the known fields. The canonical serializer preserves any
 * unknown keys at runtime; they are simply not typed here.
 */

export const FORMAT = "nodevault.tree" as const;
export const FORMAT_VERSION = 1 as const;

export const TREE_TYPES = [
  "ShaderNodeTree",
  "GeometryNodeTree",
  "CompositorNodeTree",
] as const;
export type TreeType = (typeof TREE_TYPES)[number];

export type BlenderVersion = [number, number, number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface OriginWarning {
  node_id: string;
  property: string;
  message: string;
}

export interface Origin {
  /** Center of the axis-aligned box of `location_absolute` of the root nodes, Blender coordinates (Y up). */
  selection_center: [number, number];
  /** Nodes in the root tree, not counting nodes inside groups. */
  node_count: number;
  /** Properties that could not be read at copy time. Omitted when empty. */
  warnings?: OriginWarning[];
}

export type InOut = "INPUT" | "OUTPUT";

export interface InterfaceItem {
  identifier: string;
  name: string;
  /** Socket `bl_idname`. Absent on panel items. */
  socket_type?: string;
  in_out?: InOut;
  description: string;
  default_value?: JsonValue;
  min?: number;
  max?: number;
  hide_value?: boolean;
  /** Set when the socket lives inside an interface panel. */
  parent_identifier?: string;
  /** `PANEL` for panel items. Absent or `SOCKET` for sockets. */
  item_type?: "PANEL" | "SOCKET";
}

export interface NodeSocket {
  identifier: string;
  name: string;
  label: string;
  bl_idname: string;
  type: string;
  /** Index in `node.inputs` or `node.outputs` at copy time. */
  index: number;
  /** Omitted when the socket type has no default (shader, geometry, virtual). */
  default_value?: JsonValue;
  hide: boolean;
  hide_value: boolean;
  enabled: boolean;
}

export interface NodeSockets {
  inputs: NodeSocket[];
  outputs: NodeSocket[];
}

export interface ColorRampElement {
  position: number;
  color: number[];
}

export interface ColorRampWidget {
  color_mode: string;
  interpolation: string;
  hue_interpolation: string;
  elements: ColorRampElement[];
}

export interface CurvePoint {
  location: [number, number];
  handle_type: string;
}

export interface CurveMappingWidget {
  use_clip: boolean;
  clip_min_x: number;
  clip_min_y: number;
  clip_max_x: number;
  clip_max_y: number;
  extend: string;
  curves: { points: CurvePoint[] }[];
}

export interface ImageWidget {
  name: string;
  filepath: string;
  source: string;
  colorspace: string;
}

export interface Widgets {
  color_ramp?: ColorRampWidget;
  mapping?: CurveMappingWidget;
  image?: ImageWidget;
}

export interface NodeVaultNode {
  /** `n` plus a counter, unique per tree. Links use this id, never the Blender name. */
  id: string;
  bl_idname: string;
  name: string;
  label: string;
  /** Parent-relative when `parent_id` is set. */
  location: [number, number];
  /** What the browser draws, after flipping Y. */
  location_absolute: [number, number];
  width: number;
  /** Frames only. */
  height?: number;
  parent_id: string | null;
  mute: boolean;
  hide: boolean;
  hide_unused_sockets: boolean;
  use_custom_color: boolean;
  color: number[] | null;
  properties: JsonObject;
  widgets: Widgets;
  sockets: NodeSockets;
  /** Set on group nodes to a tree id in this payload. */
  group_tree_id: string | null;
  /** The other end of a simulation, repeat, foreach, or closure zone. */
  zone_pair_id: string | null;
  /** Frames only. */
  label_size?: number;
  shrink?: boolean;
  text?: string;
}

export interface SocketRef {
  identifier: string;
  name: string;
  index: number;
}

export interface NodeVaultLink {
  id: string;
  from_node: string;
  from_socket: SocketRef;
  to_node: string;
  to_socket: SocketRef;
  is_muted: boolean;
}

export interface NodeVaultTree {
  /** `root` for the copied selection, `group:<name>` for node groups. */
  id: string;
  name: string;
  is_root: boolean;
  interface: InterfaceItem[];
  nodes: NodeVaultNode[];
  links: NodeVaultLink[];
}

export interface NodeVaultPayload {
  format: typeof FORMAT;
  format_version: typeof FORMAT_VERSION;
  blender_version: BlenderVersion;
  blender_version_string: string;
  tree_type: TreeType;
  /** ISO-8601 UTC. */
  copied_at: string;
  origin: Origin;
  /** The root first, then referenced groups depth-first. */
  trees: NodeVaultTree[];
}
