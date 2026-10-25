/**
 * Named errors. Every failed parse or validation check raises one of these
 * codes. The Python side (addon/deserialize.py) uses the same code strings.
 */
export type NoodleBinErrorCode =
  | "not_noodlebin"
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

export class NoodleBinError extends Error {
  readonly code: NoodleBinErrorCode;
  /** Dotted path into the payload when the failure is about one field. */
  readonly path: string | undefined;

  constructor(code: NoodleBinErrorCode, message: string, path?: string) {
    super(message);
    this.name = "NoodleBinError";
    this.code = code;
    this.path = path;
  }
}

export function isNoodleBinError(value: unknown): value is NoodleBinError {
  return value instanceof NoodleBinError;
}
