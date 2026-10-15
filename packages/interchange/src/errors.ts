/**
 * Named errors. Every failed envelope or validation check raises one of these
 * codes. The Python side (addon/deserialize.py) uses the same code strings.
 */
export type NodeVaultErrorCode =
  | "not_nodevault"
  | "bad_magic"
  | "bad_json"
  | "bad_format"
  | "bad_format_version"
  | "bad_tree_type"
  | "bad_blender_version"
  | "bad_root"
  | "malformed"
  | "duplicate_tree_id"
  | "duplicate_node_id"
  | "dangling_parent"
  | "dangling_group"
  | "dangling_zone_pair"
  | "dangling_link_node"
  | "dangling_link_socket";

export class NodeVaultError extends Error {
  readonly code: NodeVaultErrorCode;
  /** Dotted path into the payload when the failure is about one field. */
  readonly path: string | undefined;

  constructor(code: NodeVaultErrorCode, message: string, path?: string) {
    super(message);
    this.name = "NodeVaultError";
    this.code = code;
    this.path = path;
  }
}

export function isNodeVaultError(value: unknown): value is NodeVaultError {
  return value instanceof NodeVaultError;
}
