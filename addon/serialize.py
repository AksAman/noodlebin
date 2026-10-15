"""Write side of the ``nodevault 1`` interchange format.

Canonical JSON and the clipboard envelope. Owned by
``docs/pid/05-interchange-format.md``. Used by Copy (``copy_nodes.py``) and
Save. No ``bpy`` and no UI imports, so it runs under plain ``python3`` and
under ``blender --background --python``.

The canonical form matches ``packages/interchange/src/canonical.ts`` byte for
byte: known keys in PID order, unknown keys after them in their original order,
``properties`` and ``widgets`` left in the order Blender reported, 2-space
indent, ``JSON.stringify`` number formatting, trailing newline.
"""

from __future__ import annotations

import math
from decimal import Decimal
from typing import Any, Callable, Mapping, Sequence

MAGIC = "nodevault 1"
FORMAT = "nodevault.tree"
FORMAT_VERSION = 1
TREE_TYPES = ("ShaderNodeTree", "GeometryNodeTree", "CompositorNodeTree")

PAYLOAD_KEYS = (
    "format",
    "format_version",
    "blender_version",
    "blender_version_string",
    "tree_type",
    "copied_at",
    "origin",
    "trees",
)
ORIGIN_KEYS = ("selection_center", "node_count", "warnings")
WARNING_KEYS = ("node_id", "property", "message")
TREE_KEYS = ("id", "name", "is_root", "interface", "nodes", "links")
INTERFACE_ITEM_KEYS = (
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
)
NODE_KEYS = (
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
)
SOCKETS_KEYS = ("inputs", "outputs")
SOCKET_KEYS = (
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
)
LINK_KEYS = ("id", "from_node", "from_socket", "to_node", "to_socket", "is_muted")
SOCKET_REF_KEYS = ("identifier", "name", "index")


# --- key ordering -----------------------------------------------------------

Canon = Callable[[Any], Any]


def _is_mapping(value: Any) -> bool:
    return isinstance(value, Mapping)


def _is_sequence(value: Any) -> bool:
    return isinstance(value, Sequence) and not isinstance(
        value, (str, bytes, bytearray)
    )


def _copy(value: Any) -> Any:
    """Deep copy preserving key order. Used for unknown keys, properties, widgets."""
    if _is_mapping(value):
        return {key: _copy(value[key]) for key in value}
    if _is_sequence(value):
        return [_copy(item) for item in value]
    return value


def _order_keys(
    obj: Mapping[str, Any],
    known: Sequence[str],
    children: Mapping[str, Canon] | None = None,
) -> dict:
    children = children or {}
    out: dict[str, Any] = {}

    def emit(key: str) -> None:
        child = children.get(key)
        out[key] = child(obj[key]) if child else _copy(obj[key])

    for key in known:
        if key in obj:
            emit(key)
    for key in obj:
        if key not in known:
            emit(key)
    return out


def _each(fn: Canon) -> Canon:
    return (
        lambda value: [fn(item) for item in value]
        if _is_sequence(value)
        else _copy(value)
    )


def _socket_ref(value: Any) -> Any:
    return _order_keys(value, SOCKET_REF_KEYS) if _is_mapping(value) else _copy(value)


def _link(value: Any) -> Any:
    if not _is_mapping(value):
        return _copy(value)
    return _order_keys(
        value, LINK_KEYS, {"from_socket": _socket_ref, "to_socket": _socket_ref}
    )


def _socket(value: Any) -> Any:
    return _order_keys(value, SOCKET_KEYS) if _is_mapping(value) else _copy(value)


def _sockets(value: Any) -> Any:
    if not _is_mapping(value):
        return _copy(value)
    return _order_keys(
        value, SOCKETS_KEYS, {"inputs": _each(_socket), "outputs": _each(_socket)}
    )


def _node(value: Any) -> Any:
    if not _is_mapping(value):
        return _copy(value)
    return _order_keys(
        value, NODE_KEYS, {"sockets": _sockets, "properties": _copy, "widgets": _copy}
    )


def _interface_item(value: Any) -> Any:
    return (
        _order_keys(value, INTERFACE_ITEM_KEYS) if _is_mapping(value) else _copy(value)
    )


def _tree(value: Any) -> Any:
    if not _is_mapping(value):
        return _copy(value)
    return _order_keys(
        value,
        TREE_KEYS,
        {
            "interface": _each(_interface_item),
            "nodes": _each(_node),
            "links": _each(_link),
        },
    )


def _warning(value: Any) -> Any:
    return _order_keys(value, WARNING_KEYS) if _is_mapping(value) else _copy(value)


def _origin(value: Any) -> Any:
    if not _is_mapping(value):
        return _copy(value)
    return _order_keys(value, ORIGIN_KEYS, {"warnings": _each(_warning)})


def canonicalize(payload: Any) -> Any:
    """Return a new dict with known keys in canonical order and unknown keys preserved.

    Does not validate. Call ``deserialize.validate_payload`` first for untrusted input.
    """
    if not _is_mapping(payload):
        return _copy(payload)
    return _order_keys(
        payload, PAYLOAD_KEYS, {"origin": _origin, "trees": _each(_tree)}
    )


# --- JSON emission (JSON.stringify(value, null, 2) compatible) --------------


def format_number(value: int | float) -> str:
    """Format a number exactly as ECMAScript ``Number.prototype.toString`` does.

    Integral values print without a fraction (``5.0`` -> ``5``). Other values
    use the shortest round-trip digits in fixed notation when the decimal
    exponent is in [-6, 21), otherwise ``d.ddde±N``. ``-0.0`` prints as ``0``.
    Non-finite values are rejected because JSON has no representation for them.
    """
    if isinstance(value, bool):  # bool is an int subclass; never reach here
        raise TypeError("bool is not a number for JSON purposes")
    if isinstance(value, int):
        return str(value)
    if not math.isfinite(value):
        raise ValueError(f"Cannot serialize non-finite number {value!r}")
    if value == 0:
        return "0"

    negative = value < 0
    magnitude = -value if negative else value
    sign_tuple = Decimal(repr(magnitude)).as_tuple()
    digits = list(sign_tuple.digits)
    exponent = int(sign_tuple.exponent)
    # Strip trailing zeros from the significand; repr() may leave "100.0"-style zeros.
    while len(digits) > 1 and digits[-1] == 0:
        digits.pop()
        exponent += 1
    k = len(digits)
    n = k + exponent  # value = 0.d1d2...dk × 10^n
    s = "".join(str(d) for d in digits)

    if k <= n <= 21:
        body = s + "0" * (n - k)
    elif 0 < n <= 21:
        body = s[:n] + "." + s[n:]
    elif -6 < n <= 0:
        body = "0." + "0" * (-n) + s
    else:
        e = n - 1
        exp = ("+" if e >= 0 else "-") + str(abs(e))
        body = (s if k == 1 else s[0] + "." + s[1:]) + "e" + exp
    return "-" + body if negative else body


def _format_string(value: str) -> str:
    out = ['"']
    for ch in value:
        code = ord(ch)
        if ch == '"':
            out.append('\\"')
        elif ch == "\\":
            out.append("\\\\")
        elif ch == "\n":
            out.append("\\n")
        elif ch == "\r":
            out.append("\\r")
        elif ch == "\t":
            out.append("\\t")
        elif ch == "\b":
            out.append("\\b")
        elif ch == "\f":
            out.append("\\f")
        elif code < 0x20 or 0xD800 <= code <= 0xDFFF:
            # Control characters and lone surrogates, as JSON.stringify escapes them.
            out.append(f"\\u{code:04x}")
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def _emit(value: Any, indent: int, out: list[str]) -> None:
    if value is None:
        out.append("null")
    elif value is True:
        out.append("true")
    elif value is False:
        out.append("false")
    elif isinstance(value, (int, float)):
        out.append(format_number(value))
    elif isinstance(value, str):
        out.append(_format_string(value))
    elif _is_mapping(value):
        if not value:
            out.append("{}")
            return
        pad = "  " * (indent + 1)
        out.append("{\n")
        for i, key in enumerate(value):
            if not isinstance(key, str):
                raise TypeError(f"JSON object keys must be strings, found {key!r}")
            if i:
                out.append(",\n")
            out.append(pad)
            out.append(_format_string(key))
            out.append(": ")
            _emit(value[key], indent + 1, out)
        out.append("\n" + "  " * indent + "}")
    elif _is_sequence(value):
        if not value:
            out.append("[]")
            return
        pad = "  " * (indent + 1)
        out.append("[\n")
        for i, item in enumerate(value):
            if i:
                out.append(",\n")
            out.append(pad)
            _emit(item, indent + 1, out)
        out.append("\n" + "  " * indent + "]")
    else:
        raise TypeError(f"Cannot serialize {type(value).__name__} to JSON")


def dumps_pretty(value: Any) -> str:
    """``JSON.stringify(value, null, 2)``-compatible text, no trailing newline."""
    out: list[str] = []
    _emit(value, 0, out)
    return "".join(out)


def canonical_json(payload: Any) -> str:
    """Canonical JSON text: ordered keys, 2-space indent, trailing newline. No magic line."""
    return dumps_pretty(canonicalize(payload)) + "\n"


def canonical_text(payload: Any) -> str:
    """The full clipboard text: ``nodevault 1``, newline, canonical JSON, trailing newline."""
    return f"{MAGIC}\n{canonical_json(payload)}"
