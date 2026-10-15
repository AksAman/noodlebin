/**
 * Validation rules from the interchange PID.
 *
 * A payload is acceptable when:
 * - `format` and `format_version` match.
 * - `tree_type` is one of the three supported strings.
 * - Exactly one tree has `is_root` true and `id` `root`.
 * - Every `parent_id`, `group_tree_id`, `zone_pair_id`, and link endpoint
 *   refers to an id that exists in the same tree (groups: `group_tree_id`
 *   refers to another tree in `trees`).
 * - Every link's sockets refer to identifiers present on those nodes.
 * - `blender_version` has three non-negative integers.
 *
 * Structural checks (`malformed`) cover only what those rules need to read.
 * Fields the rules do not touch are not type-checked here.
 */

import { NodeVaultError } from "./errors";
import { FORMAT, FORMAT_VERSION, TREE_TYPES } from "./types";
import type { NodeVaultPayload } from "./types";

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

function malformed(message: string, path: string): NodeVaultError {
  return new NodeVaultError("malformed", `${message} (${path})`, path);
}

function requireRecord(value: unknown, path: string): Rec {
  if (!isRecord(value)) throw malformed("Expected an object", path);
  return value;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw malformed("Expected an array", path);
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string") throw malformed("Expected a string", path);
  return value;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw malformed("Expected a boolean", path);
  return value;
}

function optionalIdRef(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string")
    throw malformed("Expected a string or null", path);
  return value;
}

function socketIdentifiers(sockets: unknown, path: string): Set<string> {
  const ids = new Set<string>();
  for (const [i, socket] of requireArray(sockets, path).entries()) {
    const rec = requireRecord(socket, `${path}[${i}]`);
    ids.add(requireString(rec["identifier"], `${path}[${i}].identifier`));
  }
  return ids;
}

interface NodeIndex {
  inputs: Set<string>;
  outputs: Set<string>;
}

function validateTree(tree: Rec, treePath: string, treeIds: Set<string>): void {
  const treeId = requireString(tree["id"], `${treePath}.id`);
  const nodes = requireArray(tree["nodes"], `${treePath}.nodes`);
  const links = requireArray(tree["links"], `${treePath}.links`);
  requireArray(tree["interface"], `${treePath}.interface`);

  // Pass 1: ids and socket identifiers.
  const index = new Map<string, NodeIndex>();
  nodes.forEach((rawNode, i) => {
    const nodePath = `${treePath}.nodes[${i}]`;
    const node = requireRecord(rawNode, nodePath);
    const id = requireString(node["id"], `${nodePath}.id`);
    requireString(node["bl_idname"], `${nodePath}.bl_idname`);
    if (index.has(id)) {
      throw new NodeVaultError(
        "duplicate_node_id",
        `Node id "${id}" appears more than once in tree "${treeId}".`,
        `${nodePath}.id`,
      );
    }
    const sockets = requireRecord(node["sockets"], `${nodePath}.sockets`);
    index.set(id, {
      inputs: socketIdentifiers(
        sockets["inputs"],
        `${nodePath}.sockets.inputs`,
      ),
      outputs: socketIdentifiers(
        sockets["outputs"],
        `${nodePath}.sockets.outputs`,
      ),
    });
  });

  // Pass 2: references.
  nodes.forEach((rawNode, i) => {
    const node = rawNode as Rec;
    const nodePath = `${treePath}.nodes[${i}]`;
    const id = node["id"] as string;

    const parentId = optionalIdRef(node["parent_id"], `${nodePath}.parent_id`);
    if (parentId !== null && !index.has(parentId)) {
      throw new NodeVaultError(
        "dangling_parent",
        `Node "${id}" in tree "${treeId}" has parent_id "${parentId}", which is not a node in that tree.`,
        `${nodePath}.parent_id`,
      );
    }

    const groupTreeId = optionalIdRef(
      node["group_tree_id"],
      `${nodePath}.group_tree_id`,
    );
    if (
      groupTreeId !== null &&
      (!treeIds.has(groupTreeId) || groupTreeId === treeId)
    ) {
      throw new NodeVaultError(
        "dangling_group",
        `Node "${id}" in tree "${treeId}" has group_tree_id "${groupTreeId}", which is not another tree in this payload.`,
        `${nodePath}.group_tree_id`,
      );
    }

    const zonePairId = optionalIdRef(
      node["zone_pair_id"],
      `${nodePath}.zone_pair_id`,
    );
    if (zonePairId !== null && !index.has(zonePairId)) {
      throw new NodeVaultError(
        "dangling_zone_pair",
        `Node "${id}" in tree "${treeId}" has zone_pair_id "${zonePairId}", which is not a node in that tree.`,
        `${nodePath}.zone_pair_id`,
      );
    }
  });

  // Links.
  links.forEach((rawLink, i) => {
    const linkPath = `${treePath}.links[${i}]`;
    const link = requireRecord(rawLink, linkPath);
    const linkId = typeof link["id"] === "string" ? link["id"] : `#${i}`;

    const fromNode = requireString(link["from_node"], `${linkPath}.from_node`);
    const toNode = requireString(link["to_node"], `${linkPath}.to_node`);
    for (const [field, nodeId] of [
      ["from_node", fromNode],
      ["to_node", toNode],
    ] as const) {
      if (!index.has(nodeId)) {
        throw new NodeVaultError(
          "dangling_link_node",
          `Link "${linkId}" in tree "${treeId}" refers to ${field} "${nodeId}", which is not a node in that tree.`,
          `${linkPath}.${field}`,
        );
      }
    }

    const fromSocket = requireRecord(
      link["from_socket"],
      `${linkPath}.from_socket`,
    );
    const toSocket = requireRecord(link["to_socket"], `${linkPath}.to_socket`);
    const fromIdent = requireString(
      fromSocket["identifier"],
      `${linkPath}.from_socket.identifier`,
    );
    const toIdent = requireString(
      toSocket["identifier"],
      `${linkPath}.to_socket.identifier`,
    );

    if (!index.get(fromNode)!.outputs.has(fromIdent)) {
      throw new NodeVaultError(
        "dangling_link_socket",
        `Link "${linkId}" in tree "${treeId}" starts at output "${fromIdent}", which node "${fromNode}" does not have.`,
        `${linkPath}.from_socket.identifier`,
      );
    }
    if (!index.get(toNode)!.inputs.has(toIdent)) {
      throw new NodeVaultError(
        "dangling_link_socket",
        `Link "${linkId}" in tree "${treeId}" ends at input "${toIdent}", which node "${toNode}" does not have.`,
        `${linkPath}.to_socket.identifier`,
      );
    }
  });
}

/**
 * Throw a `NodeVaultError` when `value` is not an acceptable payload.
 * On return, `value` is a `NodeVaultPayload` (unknown keys may also be present).
 */
export function validatePayload(
  value: unknown,
): asserts value is NodeVaultPayload {
  const payload = requireRecord(value, "$");

  if (payload["format"] !== FORMAT) {
    throw new NodeVaultError(
      "bad_format",
      `Expected format "${FORMAT}", found ${JSON.stringify(payload["format"])}.`,
      "$.format",
    );
  }

  if (payload["format_version"] !== FORMAT_VERSION) {
    throw new NodeVaultError(
      "bad_format_version",
      `Unsupported format_version ${JSON.stringify(payload["format_version"])}. This build reads ${FORMAT_VERSION}.`,
      "$.format_version",
    );
  }

  const treeType = payload["tree_type"];
  if (
    typeof treeType !== "string" ||
    !(TREE_TYPES as readonly string[]).includes(treeType)
  ) {
    throw new NodeVaultError(
      "bad_tree_type",
      `Unsupported tree_type ${JSON.stringify(treeType)}. Expected one of ${TREE_TYPES.join(", ")}.`,
      "$.tree_type",
    );
  }

  const version = payload["blender_version"];
  if (
    !Array.isArray(version) ||
    version.length !== 3 ||
    !version.every(isNonNegativeInt)
  ) {
    throw new NodeVaultError(
      "bad_blender_version",
      `blender_version must be three non-negative integers, found ${JSON.stringify(version)}.`,
      "$.blender_version",
    );
  }

  requireString(payload["blender_version_string"], "$.blender_version_string");
  requireString(payload["copied_at"], "$.copied_at");

  const origin = requireRecord(payload["origin"], "$.origin");
  if (!isPair(origin["selection_center"])) {
    throw malformed(
      "selection_center must be [x, y]",
      "$.origin.selection_center",
    );
  }
  if (!isNonNegativeInt(origin["node_count"])) {
    throw malformed(
      "node_count must be a non-negative integer",
      "$.origin.node_count",
    );
  }

  const trees = requireArray(payload["trees"], "$.trees");
  if (trees.length === 0) throw malformed("trees must not be empty", "$.trees");

  const treeIds = new Set<string>();
  let rootCount = 0;
  let rootHasRootId = false;
  trees.forEach((rawTree, i) => {
    const treePath = `$.trees[${i}]`;
    const tree = requireRecord(rawTree, treePath);
    const id = requireString(tree["id"], `${treePath}.id`);
    requireString(tree["name"], `${treePath}.name`);
    const isRoot = requireBoolean(tree["is_root"], `${treePath}.is_root`);
    if (treeIds.has(id)) {
      throw new NodeVaultError(
        "duplicate_tree_id",
        `Tree id "${id}" appears more than once.`,
        `${treePath}.id`,
      );
    }
    treeIds.add(id);
    if (isRoot) {
      rootCount += 1;
      rootHasRootId = id === "root";
    }
  });

  if (rootCount !== 1) {
    throw new NodeVaultError(
      "bad_root",
      `Exactly one tree must have is_root true, found ${rootCount}.`,
      "$.trees",
    );
  }
  if (!rootHasRootId) {
    throw new NodeVaultError(
      "bad_root",
      `The root tree must have id "root".`,
      "$.trees",
    );
  }

  trees.forEach((tree, i) =>
    validateTree(tree as Rec, `$.trees[${i}]`, treeIds),
  );
}

/** `validatePayload` as a predicate. */
export function isValidPayload(value: unknown): value is NodeVaultPayload {
  try {
    validatePayload(value);
    return true;
  } catch (err) {
    if (err instanceof NodeVaultError) return false;
    throw err;
  }
}
