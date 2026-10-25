/**
 * Canonical JSON.
 *
 * Before the browser puts a payload back on the clipboard it re-serializes the
 * parsed object with keys in the order the interchange PID gives, 2-space
 * indent, and a trailing newline. Nothing is prepended; the text is plain
 * JSON. Unknown keys are kept and emitted after the known keys in their
 * original order. Key order inside `properties` and `widgets` is whatever
 * Blender reported at copy time and is left untouched. Numbers stay numbers.
 *
 * addon/serialize.py implements the same rules and must produce identical
 * bytes for the same object.
 */

export const PAYLOAD_KEYS = [
  "format",
  "format_version",
  "blender_version",
  "blender_version_string",
  "tree_type",
  "copied_at",
  "origin",
  "trees",
] as const;

export const ORIGIN_KEYS = [
  "selection_center",
  "node_count",
  "warnings",
] as const;
export const WARNING_KEYS = ["node_id", "property", "message"] as const;
export const TREE_KEYS = [
  "id",
  "name",
  "is_root",
  "interface",
  "nodes",
  "links",
] as const;

export const INTERFACE_ITEM_KEYS = [
  "identifier",
  "name",
  "socket_type",
  "in_out",
  "description",
  "default_value",
  "min",
  "max",
  "hide_value",
  "parent_identifier",
  "item_type",
] as const;

export const NODE_KEYS = [
  "id",
  "bl_idname",
  "name",
  "label",
  "location",
  "location_absolute",
  "width",
  "height",
  "parent_id",
  "mute",
  "hide",
  "hide_unused_sockets",
  "use_custom_color",
  "color",
  "properties",
  "widgets",
  "sockets",
  "group_tree_id",
  "zone_pair_id",
  "label_size",
  "shrink",
  "text",
] as const;

export const SOCKETS_KEYS = ["inputs", "outputs"] as const;

export const SOCKET_KEYS = [
  "identifier",
  "name",
  "label",
  "bl_idname",
  "type",
  "index",
  "default_value",
  "hide",
  "hide_value",
  "enabled",
] as const;

export const LINK_KEYS = [
  "id",
  "from_node",
  "from_socket",
  "to_node",
  "to_socket",
  "is_muted",
] as const;
export const SOCKET_REF_KEYS = ["identifier", "name", "index"] as const;

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Rebuild `obj` with `known` keys first (only those present), then every other
 * key in its original order. `children` maps a key to the canonicalizer for
 * that key's value; other values are deep-copied as-is.
 */
function orderKeys(
  obj: Rec,
  known: readonly string[],
  children: Record<string, (v: unknown) => unknown> = {},
): Rec {
  const out: Rec = {};
  const emit = (key: string) => {
    const value = obj[key];
    const child = children[key];
    out[key] = child ? child(value) : copyValue(value);
  };
  for (const key of known) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) emit(key);
  }
  for (const key of Object.keys(obj)) {
    if (!known.includes(key)) emit(key);
  }
  return out;
}

/** Deep copy preserving key order. Used for unknown keys, `properties`, and `widgets`. */
function copyValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copyValue);
  if (isRecord(value)) {
    const out: Rec = {};
    for (const key of Object.keys(value)) out[key] = copyValue(value[key]);
    return out;
  }
  return value;
}

function eachIfArray(fn: (v: unknown) => unknown): (v: unknown) => unknown {
  return (value) => (Array.isArray(value) ? value.map(fn) : copyValue(value));
}

function canonicalSocketRef(value: unknown): unknown {
  return isRecord(value) ? orderKeys(value, SOCKET_REF_KEYS) : copyValue(value);
}

function canonicalLink(value: unknown): unknown {
  if (!isRecord(value)) return copyValue(value);
  return orderKeys(value, LINK_KEYS, {
    from_socket: canonicalSocketRef,
    to_socket: canonicalSocketRef,
  });
}

function canonicalSocket(value: unknown): unknown {
  return isRecord(value) ? orderKeys(value, SOCKET_KEYS) : copyValue(value);
}

function canonicalSockets(value: unknown): unknown {
  if (!isRecord(value)) return copyValue(value);
  return orderKeys(value, SOCKETS_KEYS, {
    inputs: eachIfArray(canonicalSocket),
    outputs: eachIfArray(canonicalSocket),
  });
}

function canonicalNode(value: unknown): unknown {
  if (!isRecord(value)) return copyValue(value);
  return orderKeys(value, NODE_KEYS, {
    sockets: canonicalSockets,
    // properties and widgets keep Blender's reported order.
    properties: copyValue,
    widgets: copyValue,
  });
}

function canonicalInterfaceItem(value: unknown): unknown {
  return isRecord(value)
    ? orderKeys(value, INTERFACE_ITEM_KEYS)
    : copyValue(value);
}

function canonicalTree(value: unknown): unknown {
  if (!isRecord(value)) return copyValue(value);
  return orderKeys(value, TREE_KEYS, {
    interface: eachIfArray(canonicalInterfaceItem),
    nodes: eachIfArray(canonicalNode),
    links: eachIfArray(canonicalLink),
  });
}

function canonicalWarning(value: unknown): unknown {
  return isRecord(value) ? orderKeys(value, WARNING_KEYS) : copyValue(value);
}

function canonicalOrigin(value: unknown): unknown {
  if (!isRecord(value)) return copyValue(value);
  return orderKeys(value, ORIGIN_KEYS, {
    warnings: eachIfArray(canonicalWarning),
  });
}

/**
 * Return a new object with every known key in canonical order and every
 * unknown key preserved. Does not validate; call `validatePayload` first if
 * the input is untrusted.
 */
export function canonicalize<T>(payload: T): T {
  if (!isRecord(payload)) return copyValue(payload) as T;
  return orderKeys(payload, PAYLOAD_KEYS, {
    origin: canonicalOrigin,
    trees: eachIfArray(canonicalTree),
  }) as T;
}

/**
 * Canonical JSON text: ordered keys, 2-space indent, trailing newline.
 * This is the clipboard text and the `.noodlebin.json` file content.
 */
export function canonicalJson(payload: unknown): string {
  return JSON.stringify(canonicalize(payload), null, 2) + "\n";
}
