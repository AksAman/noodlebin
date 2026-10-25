"""Capture a node selection into a ``noodlebin.tree`` payload dict.

Owned by docs/pid/01-copy-from-blender.md. Uses ``bpy``. Call from the
Copy operator or from ``blender --background --python`` tests. Canonical
JSON emission stays in serialize.py (no bpy).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .serialize import FORMAT, FORMAT_VERSION, TREE_TYPES

# Explicit node fields plus RNA we never put in properties.
_PROPERTY_SKIP = frozenset(
    {
        "rna_type",
        "inputs",
        "outputs",
        "internal_links",
        "parent",
        "location",
        "location_absolute",
        "dimensions",
        "width",
        "height",
        "name",
        "label",
        "mute",
        "hide",
        "hide_unused_sockets",
        "use_custom_color",
        "color",
        "select",
        "show_options",
        "show_preview",
        "show_texture",
        "color_tag",
        "type",
        "select_socket",
    }
)

_GROUP_BL_IDNAMES = frozenset(
    {"ShaderNodeGroup", "GeometryNodeGroup", "CompositorNodeGroup"}
)
_PAIR_PROPS = ("paired_output", "paired_input")
_THROWAY = "_noodlebin_capture"


class CaptureError(Exception):
    """The selection cannot be captured. The operator reports the message."""


def _now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _vec(value: Any) -> list[float]:
    return [float(x) for x in value]


def _round_float(value: float) -> float:
    return float(f"{float(value):.6f}")


def _json_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, int) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, float):
        return _round_float(value)
    if hasattr(value, "to_list"):
        try:
            return _json_value(value.to_list())
        except Exception:
            pass
    try:
        seq = list(value)
    except TypeError:
        ident = getattr(value, "identifier", None)
        if isinstance(ident, str):
            return ident
        return None
    if seq and not isinstance(seq[0], (int, float, str, bool, type(None))):
        # nested RNA; skip
        if not isinstance(seq[0], (list, tuple)):
            try:
                return [_round_float(float(x)) for x in seq]
            except (TypeError, ValueError):
                return None
    out = []
    for item in seq:
        if isinstance(item, float):
            out.append(_round_float(item))
        elif isinstance(item, bool):
            out.append(item)
        elif isinstance(item, int):
            out.append(int(item))
        else:
            out.append(_json_value(item))
    return out


def _prop_equal(a: Any, b: Any) -> bool:
    ja, jb = _json_value(a), _json_value(b)
    return ja == jb


def _abs_xy(node: Any) -> tuple[float, float]:
    loc = node.location_absolute
    return (float(loc[0]), float(loc[1]))


def _sort_key(node: Any) -> tuple[float, float, str]:
    x, y = _abs_xy(node)
    return (y, x, node.name)


def poll_copy(context: Any, *, all_nodes: bool = False) -> tuple[bool, str]:
    """Return (ok, status). Status names the missing condition when not ok."""
    space = getattr(context, "space_data", None)
    if space is None or getattr(space, "type", None) != "NODE_EDITOR":
        return False, "no node tree"
    tree = getattr(space, "node_tree", None)
    if tree is None:
        return False, "no node tree"
    tree_type = getattr(space, "tree_type", "") or getattr(tree, "bl_idname", "")
    if tree_type not in TREE_TYPES:
        return False, "unsupported editor"
    if hasattr(tree, "is_editable") and not tree.is_editable:
        return False, "no node tree"
    if all_nodes:
        if not tree.nodes:
            return False, "nothing to copy"
        return True, ""
    selected = [n for n in tree.nodes if n.select]
    if not selected:
        return False, "nothing selected"
    return True, ""


_affects_cache: dict[tuple[int, int, int], dict[str, set[str]] | None] = {}


def load_affects_map(blender_version: tuple[int, int, int]) -> dict[str, set[str]] | None:
    """bl_idname → property identifiers flagged affects_sockets. None if no catalog."""
    if blender_version in _affects_cache:
        return _affects_cache[blender_version]
    catalog = _load_catalog(blender_version)
    if catalog is None:
        _affects_cache[blender_version] = None
        return None
    out: dict[str, set[str]] = {}
    for bid, rec in (catalog.get("nodes") or {}).items():
        flagged = {p["identifier"] for p in rec.get("properties") or [] if p.get("affects_sockets")}
        if flagged:
            out[bid] = flagged
    _affects_cache[blender_version] = out
    return out


def _load_catalog(blender_version: tuple[int, int, int]) -> dict[str, Any] | None:
    roots = [
        Path(__file__).resolve().parent / "catalog" / "versions",
        Path(__file__).resolve().parents[1] / "catalog" / "versions",
    ]
    catalogs: list[dict[str, Any]] = []
    for root in roots:
        if not root.is_dir():
            continue
        for path in root.glob("*/catalog.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            ver = data.get("blender_version")
            if isinstance(ver, list) and len(ver) == 3:
                catalogs.append(data)
    if not catalogs:
        return None
    exact = [c for c in catalogs if tuple(c["blender_version"]) == tuple(blender_version)]
    if exact:
        return exact[0]
    same = [
        c
        for c in catalogs
        if c["blender_version"][0] == blender_version[0] and c["blender_version"][1] == blender_version[1]
    ]
    if not same:
        return None
    same.sort(key=lambda c: (abs(c["blender_version"][2] - blender_version[2]), -c["blender_version"][2]))
    return same[0]


def _pair_node(node: Any) -> Any | None:
    for name in _PAIR_PROPS:
        if name not in node.bl_rna.properties:
            continue
        try:
            other = getattr(node, name)
        except Exception:
            continue
        if other is not None:
            return other
    return None


def expand_selection(tree: Any, selected: Iterable[Any]) -> list[Any]:
    """Apply zone-pair and parent-frame rules. Groups are handled when capturing trees."""
    by_ptr = {n.as_pointer(): n for n in tree.nodes}
    chosen = {n.as_pointer(): n for n in selected}
    changed = True
    while changed:
        changed = False
        for node in list(chosen.values()):
            partner = _pair_node(node)
            if partner is not None and partner.as_pointer() not in chosen:
                if partner.as_pointer() in by_ptr:
                    chosen[partner.as_pointer()] = partner
                    changed = True
            parent = node.parent
            while parent is not None:
                if parent.as_pointer() not in chosen:
                    chosen[parent.as_pointer()] = parent
                    changed = True
                parent = parent.parent
    return list(chosen.values())


def _socket_record(socket: Any, index: int) -> dict[str, Any] | None:
    bl_idname = getattr(socket, "bl_idname", "") or ""
    if bl_idname == "NodeSocketVirtual":
        return None
    rec: dict[str, Any] = {
        "identifier": socket.identifier,
        "name": socket.name,
        "label": getattr(socket, "label", "") or "",
        "bl_idname": bl_idname,
        "type": getattr(socket, "type", "") or "",
        "index": index,
        "hide": bool(getattr(socket, "hide", False)),
        "hide_value": bool(getattr(socket, "hide_value", False)),
        "enabled": bool(getattr(socket, "enabled", True)),
    }
    try:
        default = socket.default_value
    except Exception:
        default = None
    parsed = _json_value(default) if default is not None else None
    if parsed is not None:
        rec["default_value"] = parsed
    return rec


def _capture_sockets(node: Any) -> dict[str, list[dict[str, Any]]]:
    inputs = []
    outputs = []
    for i, s in enumerate(node.inputs):
        rec = _socket_record(s, i)
        if rec:
            inputs.append(rec)
    for i, s in enumerate(node.outputs):
        rec = _socket_record(s, i)
        if rec:
            outputs.append(rec)
    return {"inputs": inputs, "outputs": outputs}


def _widget_color_ramp(ramp: Any) -> dict[str, Any]:
    return {
        "color_mode": ramp.color_mode,
        "interpolation": ramp.interpolation,
        "hue_interpolation": getattr(ramp, "hue_interpolation", "NEAR"),
        "elements": [
            {"position": _round_float(el.position), "color": [_round_float(c) for c in el.color]}
            for el in ramp.elements
        ],
    }


def _widget_curve(mapping: Any) -> dict[str, Any]:
    curves = []
    for curve in mapping.curves:
        curves.append(
            {
                "points": [
                    {
                        "location": [_round_float(p.location[0]), _round_float(p.location[1])],
                        "handle_type": p.handle_type,
                    }
                    for p in curve.points
                ]
            }
        )
    return {
        "use_clip": bool(mapping.use_clip),
        "clip_min_x": _round_float(mapping.clip_min_x),
        "clip_min_y": _round_float(mapping.clip_min_y),
        "clip_max_x": _round_float(mapping.clip_max_x),
        "clip_max_y": _round_float(mapping.clip_max_y),
        "extend": mapping.extend,
        "curves": curves,
    }


def _widget_image(image: Any) -> dict[str, Any] | None:
    if image is None:
        return None
    cs = ""
    settings = getattr(image, "colorspace_settings", None)
    if settings is not None:
        cs = getattr(settings, "name", "") or ""
    return {
        "name": image.name,
        "filepath": getattr(image, "filepath", "") or "",
        "source": getattr(image, "source", "") or "",
        "colorspace": cs,
    }


def _capture_widgets(node: Any) -> dict[str, Any]:
    widgets: dict[str, Any] = {}
    for prop in node.bl_rna.properties:
        ident = prop.identifier
        if ident.startswith(("bl_", "_", "rna_")):
            continue
        try:
            value = getattr(node, ident)
        except Exception:
            continue
        type_name = type(value).__name__ if value is not None else ""
        fixed = getattr(getattr(prop, "fixed_type", None), "identifier", None)
        if type_name == "ColorRamp" or fixed == "ColorRamp":
            widgets[ident] = _widget_color_ramp(value)
        elif type_name == "CurveMapping" or fixed == "CurveMapping":
            widgets[ident] = _widget_curve(value)
        elif ident == "image" and (type_name == "Image" or fixed == "Image"):
            img = _widget_image(value)
            if img is not None:
                widgets[ident] = img
    return widgets


def _writable_props(node: Any) -> list[Any]:
    out = []
    for prop in node.bl_rna.properties:
        ident = prop.identifier
        if ident in _PROPERTY_SKIP or ident.startswith(("bl_", "_")):
            continue
        if prop.is_readonly:
            continue
        if prop.type in {"COLLECTION", "POINTER"}:
            continue
        out.append(prop)
    return out


def _fresh_defaults(tree: Any, bl_idname: str) -> tuple[dict[str, Any] | None, str | None]:
    try:
        fresh = tree.nodes.new(bl_idname)
    except Exception as exc:
        return None, str(exc).strip() or type(exc).__name__
    try:
        values = {}
        for prop in _writable_props(fresh):
            try:
                values[prop.identifier] = getattr(fresh, prop.identifier)
            except Exception:
                continue
        return values, None
    finally:
        try:
            tree.nodes.remove(fresh)
        except Exception:
            pass


def _capture_properties(
    node: Any,
    fresh_values: dict[str, Any] | None,
    always: set[str],
    store_all_enum_bool: bool,
    warnings: list[dict[str, str]],
    node_id: str,
) -> dict[str, Any]:
    props: dict[str, Any] = {}
    for prop in _writable_props(node):
        ident = prop.identifier
        try:
            value = getattr(node, ident)
        except Exception as exc:
            warnings.append({"node_id": node_id, "property": ident, "message": str(exc)})
            continue
        keep = ident in always
        if store_all_enum_bool and prop.type in {"ENUM", "BOOLEAN"}:
            keep = True
        if fresh_values is None and prop.type in {"ENUM", "BOOLEAN"}:
            keep = True
        if fresh_values is not None and ident in fresh_values:
            if not _prop_equal(value, fresh_values[ident]):
                keep = True
        elif fresh_values is not None and ident not in fresh_values:
            keep = True
        if not keep:
            continue
        parsed = _json_value(value)
        if parsed is None and value is not None and prop.type == "ENUM":
            parsed = str(value)
        if parsed is None and value is not None:
            continue
        props[ident] = parsed
    return props


def _interface_items(tree: Any) -> list[dict[str, Any]]:
    iface = getattr(tree, "interface", None)
    if iface is None or not hasattr(iface, "items_tree"):
        return []
    items: list[dict[str, Any]] = []
    for raw in iface.items_tree:
        item_type = getattr(raw, "item_type", "SOCKET")
        rec: dict[str, Any] = {
            "identifier": getattr(raw, "identifier", "") or "",
            "name": getattr(raw, "name", "") or "",
            "description": getattr(raw, "description", "") or "",
        }
        parent = getattr(raw, "parent", None)
        if parent is not None:
            rec["parent_identifier"] = getattr(parent, "identifier", "") or ""
        if item_type == "PANEL":
            rec["item_type"] = "PANEL"
            items.append(rec)
            continue
        rec["item_type"] = "SOCKET"
        rec["socket_type"] = getattr(raw, "socket_type", "") or ""
        rec["in_out"] = getattr(raw, "in_out", "") or ""
        rec["hide_value"] = bool(getattr(raw, "hide_value", False))
        try:
            default = raw.default_value
            parsed = _json_value(default)
            if parsed is not None:
                rec["default_value"] = parsed
        except Exception:
            pass
        for key in ("min_value", "max_value"):
            if hasattr(raw, key):
                try:
                    rec[{"min_value": "min", "max_value": "max"}[key]] = _round_float(float(getattr(raw, key)))
                except Exception:
                    pass
        items.append(rec)
    return items


def _capture_node(
    node: Any,
    node_id: str,
    id_map: dict[int, str],
    group_tree_id: str | None,
    fresh_values: dict[str, Any] | None,
    always: set[str],
    store_all_enum_bool: bool,
    warnings: list[dict[str, str]],
) -> dict[str, Any]:
    parent = node.parent
    parent_id = id_map.get(parent.as_pointer()) if parent is not None else None
    partner = _pair_node(node)
    zone_pair_id = id_map.get(partner.as_pointer()) if partner is not None else None
    rec: dict[str, Any] = {
        "id": node_id,
        "bl_idname": node.bl_idname,
        "name": node.name,
        "label": node.label or "",
        "location": _vec(node.location),
        "location_absolute": _vec(node.location_absolute),
        "width": float(node.width),
        "parent_id": parent_id,
        "mute": bool(node.mute),
        "hide": bool(node.hide),
        "hide_unused_sockets": bool(getattr(node, "hide_unused_sockets", False)),
        "use_custom_color": bool(node.use_custom_color),
        "color": _vec(node.color) if node.use_custom_color else None,
        "properties": _capture_properties(
            node, fresh_values, always, store_all_enum_bool, warnings, node_id
        ),
        "widgets": _capture_widgets(node),
        "sockets": _capture_sockets(node),
        "group_tree_id": group_tree_id,
        "zone_pair_id": zone_pair_id,
    }
    if node.bl_idname == "NodeFrame":
        rec["height"] = float(node.height)
        if hasattr(node, "label_size"):
            rec["label_size"] = int(node.label_size)
        if hasattr(node, "shrink"):
            rec["shrink"] = bool(node.shrink)
        text = getattr(node, "text", None)
        if text is not None and hasattr(text, "as_string"):
            rec["text"] = text.as_string()
        elif isinstance(text, str):
            rec["text"] = text
    return rec


def _capture_links(tree: Any, id_map: dict[int, str]) -> list[dict[str, Any]]:
    links = []
    n = 1
    for link in tree.links:
        if not getattr(link, "is_valid", True):
            continue
        from_id = id_map.get(link.from_node.as_pointer())
        to_id = id_map.get(link.to_node.as_pointer())
        if from_id is None or to_id is None:
            continue
        if getattr(link.from_socket, "bl_idname", "") == "NodeSocketVirtual":
            continue
        if getattr(link.to_socket, "bl_idname", "") == "NodeSocketVirtual":
            continue
        from_sock = link.from_socket
        to_sock = link.to_socket
        try:
            from_index = list(link.from_node.outputs).index(from_sock)
        except ValueError:
            from_index = 0
        try:
            to_index = list(link.to_node.inputs).index(to_sock)
        except ValueError:
            to_index = 0
        links.append(
            {
                "id": f"l{n}",
                "from_node": from_id,
                "from_socket": {
                    "identifier": from_sock.identifier,
                    "name": from_sock.name,
                    "index": from_index,
                },
                "to_node": to_id,
                "to_socket": {
                    "identifier": to_sock.identifier,
                    "name": to_sock.name,
                    "index": to_index,
                },
                "is_muted": bool(getattr(link, "is_muted", False)),
            }
        )
        n += 1
    return links


def _group_tree_id(name: str, used: set[str]) -> str:
    base = f"group:{name}"
    if base not in used:
        used.add(base)
        return base
    i = 1
    while f"{base}.{i:03d}" in used:
        i += 1
    ident = f"{base}.{i:03d}"
    used.add(ident)
    return ident


def capture_nodes(
    tree: Any,
    selected: Iterable[Any],
    *,
    tree_type: str | None = None,
    copied_at: str | None = None,
    blender_version: tuple[int, int, int] | None = None,
    blender_version_string: str | None = None,
) -> dict[str, Any]:
    """Build a payload dict for ``selected`` nodes in ``tree``. Does not touch the clipboard."""
    import bpy

    tree_type = tree_type or tree.bl_idname
    if tree_type not in TREE_TYPES:
        raise CaptureError(f"unsupported editor ({tree_type})")
    selected_list = list(selected)
    if not selected_list:
        raise CaptureError("nothing selected")

    version = blender_version or tuple(int(x) for x in bpy.app.version)
    version_string = blender_version_string or bpy.app.version_string
    affects = load_affects_map(version)
    store_all_enum_bool = affects is None
    throwaways: dict[str, Any] = {}

    def throwaway_for(tt: str) -> Any:
        if tt not in throwaways:
            throwaways[tt] = bpy.data.node_groups.new(f"{_THROWAY}_{tt}", tt)
        return throwaways[tt]

    warnings: list[dict[str, str]] = []
    used_group_ids: set[str] = set()
    group_payloads: list[dict[str, Any]] = []
    seen_groups: dict[int, str] = {}

    def capture_group_tree(group_tree: Any) -> str:
        key = group_tree.as_pointer()
        if key in seen_groups:
            return seen_groups[key]
        # Nested groups first (inner before any tree that only exists inside it).
        nested: list[Any] = []
        for node in group_tree.nodes:
            if node.bl_idname in _GROUP_BL_IDNAMES:
                inner = getattr(node, "node_tree", None)
                if inner is not None:
                    nested.append(inner)
        for inner in nested:
            capture_group_tree(inner)
        tree_id = _group_tree_id(group_tree.name, used_group_ids)
        seen_groups[key] = tree_id
        nodes = sorted(list(group_tree.nodes), key=_sort_key)
        id_map = {n.as_pointer(): f"n{i}" for i, n in enumerate(nodes, start=1)}
        captured = []
        for node in nodes:
            nid = id_map[node.as_pointer()]
            gtid = None
            if node.bl_idname in _GROUP_BL_IDNAMES:
                inner = getattr(node, "node_tree", None)
                if inner is not None:
                    gtid = capture_group_tree(inner)
            fresh, err = _fresh_defaults(throwaway_for(group_tree.bl_idname), node.bl_idname)
            if err:
                warnings.append({"node_id": nid, "property": "*", "message": f"no fresh node: {err}"})
            always = (affects or {}).get(node.bl_idname, set())
            captured.append(
                _capture_node(
                    node,
                    nid,
                    id_map,
                    gtid,
                    fresh,
                    always,
                    store_all_enum_bool or fresh is None,
                    warnings,
                )
            )
        group_payloads.append(
            {
                "id": tree_id,
                "name": group_tree.name,
                "is_root": False,
                "interface": _interface_items(group_tree),
                "nodes": captured,
                "links": _capture_links(group_tree, id_map),
            }
        )
        return tree_id

    try:
        nodes = sorted(expand_selection(tree, selected_list), key=_sort_key)
        id_map = {n.as_pointer(): f"n{i}" for i, n in enumerate(nodes, start=1)}
        captured_nodes = []
        for node in nodes:
            nid = id_map[node.as_pointer()]
            gtid = None
            if node.bl_idname in _GROUP_BL_IDNAMES:
                inner = getattr(node, "node_tree", None)
                if inner is not None:
                    gtid = capture_group_tree(inner)
            fresh, err = _fresh_defaults(throwaway_for(tree_type), node.bl_idname)
            if err:
                warnings.append({"node_id": nid, "property": "*", "message": f"no fresh node: {err}"})
            always = (affects or {}).get(node.bl_idname, set())
            captured_nodes.append(
                _capture_node(
                    node,
                    nid,
                    id_map,
                    gtid,
                    fresh,
                    always,
                    store_all_enum_bool or fresh is None,
                    warnings,
                )
            )
        xs = [_abs_xy(n)[0] for n in nodes]
        ys = [_abs_xy(n)[1] for n in nodes]
        origin: dict[str, Any] = {
            "selection_center": [
                _round_float((min(xs) + max(xs)) / 2.0),
                _round_float((min(ys) + max(ys)) / 2.0),
            ],
            "node_count": len(captured_nodes),
        }
        if warnings:
            origin["warnings"] = warnings
        payload = {
            "format": FORMAT,
            "format_version": FORMAT_VERSION,
            "blender_version": [int(x) for x in version],
            "blender_version_string": version_string,
            "tree_type": tree_type,
            "copied_at": copied_at or _now_utc(),
            "origin": origin,
            "trees": [
                {
                    "id": "root",
                    "name": tree.name,
                    "is_root": True,
                    "interface": [],
                    "nodes": captured_nodes,
                    "links": _capture_links(tree, id_map),
                },
                *group_payloads,
            ],
        }
        return payload
    finally:
        for ng in throwaways.values():
            try:
                bpy.data.node_groups.remove(ng)
            except Exception:
                pass


def capture_text(tree: Any, selected: Iterable[Any], **kwargs: Any) -> str:
    from .serialize import canonical_json

    return canonical_json(capture_nodes(tree, selected, **kwargs))
