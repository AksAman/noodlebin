"""Read side of the ``nodevault.tree`` interchange format.

Text parsing and validation. Owned by ``docs/pid/05-interchange-format.md``.
Used by Paste (``paste_nodes.py``). No ``bpy`` and no UI imports.

Error codes match ``packages/interchange/src/errors.ts`` so both ends of the
loop name the same failure the same way.
"""

from __future__ import annotations

import json
from typing import Any

from .serialize import FORMAT, FORMAT_VERSION, TREE_TYPES

_NOT_A_TREE = "Clipboard is not a NodeVault node tree."

ERROR_CODES = frozenset(
    {
        "not_nodevault",
        "bad_json",
        "bad_format",
        "bad_format_version",
        "bad_tree_type",
        "bad_blender_version",
        "bad_root",
        "malformed",
        "duplicate_tree_id",
        "duplicate_node_id",
        "dangling_parent",
        "dangling_group",
        "dangling_zone_pair",
        "dangling_link_node",
        "dangling_link_socket",
    }
)


class NodeVaultError(ValueError):
    """A named parse or validation failure."""

    def __init__(self, code: str, message: str, path: str | None = None):
        assert code in ERROR_CODES, code
        super().__init__(message)
        self.code = code
        self.path = path


# --- text -------------------------------------------------------------------


def _normalize(text: str) -> str:
    """Strip surrounding whitespace and byte order marks.

    JavaScript's ``String.prototype.trim`` treats U+FEFF as whitespace; this
    matches it so both parsers accept the same texts.
    """
    while True:
        stripped = text.strip().strip("\ufeff")
        if stripped == text:
            return text
        text = stripped


def looks_like_nodevault(text: str) -> bool:
    """Cheap pre-check before a full parse: a JSON object that mentions the format."""
    body = _normalize(text)
    return body.startswith("{") and FORMAT in body


def parse_clipboard_text(text: str) -> dict:
    """Parse clipboard or file text into a validated payload dict. Raises ``NodeVaultError``.

    The text is one JSON object with no prefix. Text that does not look like a
    NodeVault object is ``not_nodevault`` and is never parsed. Text that looks
    like one but fails to parse is ``bad_json``.
    """
    body = _normalize(text)

    if not looks_like_nodevault(body):
        raise NodeVaultError("not_nodevault", _NOT_A_TREE)

    try:
        value = json.loads(body)
    except ValueError as err:
        raise NodeVaultError(
            "bad_json",
            f"The clipboard looks like a NodeVault node tree but is not valid JSON: {err}",
        ) from err

    fmt = value.get("format") if isinstance(value, dict) else None
    if fmt != FORMAT:
        raise NodeVaultError("not_nodevault", _NOT_A_TREE)

    validate_payload(value)
    return value


# --- validation -------------------------------------------------------------


def _malformed(message: str, path: str) -> NodeVaultError:
    return NodeVaultError("malformed", f"{message} ({path})", path)


def _require_dict(value: Any, path: str) -> dict:
    if not isinstance(value, dict):
        raise _malformed("Expected an object", path)
    return value


def _require_list(value: Any, path: str) -> list:
    if not isinstance(value, list):
        raise _malformed("Expected an array", path)
    return value


def _require_str(value: Any, path: str) -> str:
    if not isinstance(value, str):
        raise _malformed("Expected a string", path)
    return value


def _require_bool(value: Any, path: str) -> bool:
    if not isinstance(value, bool):
        raise _malformed("Expected a boolean", path)
    return value


def _is_non_negative_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _is_number(value: Any) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and value == value
        and value
        not in (
            float("inf"),
            float("-inf"),
        )
    )


def _optional_id_ref(value: Any, path: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise _malformed("Expected a string or null", path)
    return value


def _socket_identifiers(sockets: Any, path: str) -> set[str]:
    ids: set[str] = set()
    for i, socket in enumerate(_require_list(sockets, path)):
        rec = _require_dict(socket, f"{path}[{i}]")
        ids.add(_require_str(rec.get("identifier"), f"{path}[{i}].identifier"))
    return ids


def _validate_tree(tree: dict, tree_path: str, tree_ids: set[str]) -> None:
    tree_id = _require_str(tree.get("id"), f"{tree_path}.id")
    nodes = _require_list(tree.get("nodes"), f"{tree_path}.nodes")
    links = _require_list(tree.get("links"), f"{tree_path}.links")
    _require_list(tree.get("interface"), f"{tree_path}.interface")

    index: dict[str, tuple[set[str], set[str]]] = {}
    for i, raw in enumerate(nodes):
        node_path = f"{tree_path}.nodes[{i}]"
        node = _require_dict(raw, node_path)
        node_id = _require_str(node.get("id"), f"{node_path}.id")
        _require_str(node.get("bl_idname"), f"{node_path}.bl_idname")
        if node_id in index:
            raise NodeVaultError(
                "duplicate_node_id",
                f'Node id "{node_id}" appears more than once in tree "{tree_id}".',
                f"{node_path}.id",
            )
        sockets = _require_dict(node.get("sockets"), f"{node_path}.sockets")
        index[node_id] = (
            _socket_identifiers(sockets.get("inputs"), f"{node_path}.sockets.inputs"),
            _socket_identifiers(sockets.get("outputs"), f"{node_path}.sockets.outputs"),
        )

    for i, node in enumerate(nodes):
        node_path = f"{tree_path}.nodes[{i}]"
        node_id = node["id"]

        parent_id = _optional_id_ref(node.get("parent_id"), f"{node_path}.parent_id")
        if parent_id is not None and parent_id not in index:
            raise NodeVaultError(
                "dangling_parent",
                f'Node "{node_id}" in tree "{tree_id}" has parent_id "{parent_id}", '
                "which is not a node in that tree.",
                f"{node_path}.parent_id",
            )

        group_tree_id = _optional_id_ref(
            node.get("group_tree_id"), f"{node_path}.group_tree_id"
        )
        if group_tree_id is not None and (
            group_tree_id not in tree_ids or group_tree_id == tree_id
        ):
            raise NodeVaultError(
                "dangling_group",
                f'Node "{node_id}" in tree "{tree_id}" has group_tree_id "{group_tree_id}", '
                "which is not another tree in this payload.",
                f"{node_path}.group_tree_id",
            )

        zone_pair_id = _optional_id_ref(
            node.get("zone_pair_id"), f"{node_path}.zone_pair_id"
        )
        if zone_pair_id is not None and zone_pair_id not in index:
            raise NodeVaultError(
                "dangling_zone_pair",
                f'Node "{node_id}" in tree "{tree_id}" has zone_pair_id "{zone_pair_id}", '
                "which is not a node in that tree.",
                f"{node_path}.zone_pair_id",
            )

    for i, raw in enumerate(links):
        link_path = f"{tree_path}.links[{i}]"
        link = _require_dict(raw, link_path)
        link_id = link["id"] if isinstance(link.get("id"), str) else f"#{i}"

        from_node = _require_str(link.get("from_node"), f"{link_path}.from_node")
        to_node = _require_str(link.get("to_node"), f"{link_path}.to_node")
        for field, node_id in (("from_node", from_node), ("to_node", to_node)):
            if node_id not in index:
                raise NodeVaultError(
                    "dangling_link_node",
                    f'Link "{link_id}" in tree "{tree_id}" refers to {field} "{node_id}", '
                    "which is not a node in that tree.",
                    f"{link_path}.{field}",
                )

        from_socket = _require_dict(link.get("from_socket"), f"{link_path}.from_socket")
        to_socket = _require_dict(link.get("to_socket"), f"{link_path}.to_socket")
        from_ident = _require_str(
            from_socket.get("identifier"), f"{link_path}.from_socket.identifier"
        )
        to_ident = _require_str(
            to_socket.get("identifier"), f"{link_path}.to_socket.identifier"
        )

        if from_ident not in index[from_node][1]:
            raise NodeVaultError(
                "dangling_link_socket",
                f'Link "{link_id}" in tree "{tree_id}" starts at output "{from_ident}", '
                f'which node "{from_node}" does not have.',
                f"{link_path}.from_socket.identifier",
            )
        if to_ident not in index[to_node][0]:
            raise NodeVaultError(
                "dangling_link_socket",
                f'Link "{link_id}" in tree "{tree_id}" ends at input "{to_ident}", '
                f'which node "{to_node}" does not have.',
                f"{link_path}.to_socket.identifier",
            )


def validate_payload(value: Any) -> None:
    """Raise ``NodeVaultError`` unless ``value`` is an acceptable payload."""
    payload = _require_dict(value, "$")

    if payload.get("format") != FORMAT:
        raise NodeVaultError(
            "bad_format",
            f'Expected format "{FORMAT}", found {json.dumps(payload.get("format"))}.',
            "$.format",
        )

    version = payload.get("format_version")
    if isinstance(version, bool) or version != FORMAT_VERSION:
        raise NodeVaultError(
            "bad_format_version",
            f"Unsupported format_version {json.dumps(version)}. This build reads {FORMAT_VERSION}.",
            "$.format_version",
        )

    tree_type = payload.get("tree_type")
    if not isinstance(tree_type, str) or tree_type not in TREE_TYPES:
        raise NodeVaultError(
            "bad_tree_type",
            f"Unsupported tree_type {json.dumps(tree_type)}. Expected one of {', '.join(TREE_TYPES)}.",
            "$.tree_type",
        )

    bv = payload.get("blender_version")
    if (
        not isinstance(bv, list)
        or len(bv) != 3
        or not all(_is_non_negative_int(x) for x in bv)
    ):
        raise NodeVaultError(
            "bad_blender_version",
            f"blender_version must be three non-negative integers, found {json.dumps(bv)}.",
            "$.blender_version",
        )

    _require_str(payload.get("blender_version_string"), "$.blender_version_string")
    _require_str(payload.get("copied_at"), "$.copied_at")

    origin = _require_dict(payload.get("origin"), "$.origin")
    center = origin.get("selection_center")
    if not (
        isinstance(center, list)
        and len(center) == 2
        and all(_is_number(c) for c in center)
    ):
        raise _malformed("selection_center must be [x, y]", "$.origin.selection_center")
    if not _is_non_negative_int(origin.get("node_count")):
        raise _malformed(
            "node_count must be a non-negative integer", "$.origin.node_count"
        )

    trees = _require_list(payload.get("trees"), "$.trees")
    if not trees:
        raise _malformed("trees must not be empty", "$.trees")

    tree_ids: set[str] = set()
    root_count = 0
    root_has_root_id = False
    for i, raw in enumerate(trees):
        tree_path = f"$.trees[{i}]"
        tree = _require_dict(raw, tree_path)
        tree_id = _require_str(tree.get("id"), f"{tree_path}.id")
        _require_str(tree.get("name"), f"{tree_path}.name")
        is_root = _require_bool(tree.get("is_root"), f"{tree_path}.is_root")
        if tree_id in tree_ids:
            raise NodeVaultError(
                "duplicate_tree_id",
                f'Tree id "{tree_id}" appears more than once.',
                f"{tree_path}.id",
            )
        tree_ids.add(tree_id)
        if is_root:
            root_count += 1
            root_has_root_id = tree_id == "root"

    if root_count != 1:
        raise NodeVaultError(
            "bad_root",
            f"Exactly one tree must have is_root true, found {root_count}.",
            "$.trees",
        )
    if not root_has_root_id:
        raise NodeVaultError(
            "bad_root", 'The root tree must have id "root".', "$.trees"
        )

    for i, tree in enumerate(trees):
        _validate_tree(tree, f"$.trees[{i}]", tree_ids)


def is_valid_payload(value: Any) -> bool:
    try:
        validate_payload(value)
    except NodeVaultError:
        return False
    return True
