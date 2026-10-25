"""Rebuild a noodlebin.tree payload into a live node tree.

Owned by docs/pid/04-paste-in-blender.md. Uses bpy. The operator is paste_nodes.py.
"""
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import bpy

from .capture import load_affects_map

_GROUP_BL = frozenset({"ShaderNodeGroup", "GeometryNodeGroup", "CompositorNodeGroup"})
_SKIP_PROPS = frozenset(
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
        "node_tree",
        "paired_output",
        "paired_input",
        "type",
    }
)
_TREE_WORDS = {
    "ShaderNodeTree": "shader tree",
    "GeometryNodeTree": "geometry nodes",
    "CompositorNodeTree": "compositor",
}


@dataclass
class Skip:
    target: str
    reason: str


@dataclass
class PasteResult:
    nodes: int = 0
    links: int = 0
    skips: list[Skip] = field(default_factory=list)
    created: list[Any] = field(default_factory=list)


last_skips: list[Skip] = []


def clear_skips() -> None:
    last_skips.clear()


class TreeTypeMismatch(Exception):
    def __init__(self, copied: str, editor: str):
        copied_w = _TREE_WORDS.get(copied, copied)
        editor_w = _TREE_WORDS.get(editor, editor)
        super().__init__(f"Copied from a {copied_w}. This editor is {editor_w}.")
        self.copied = copied
        self.editor = editor


def _assign(obj: Any, ident: str, value: Any) -> bool:
    try:
        cur = getattr(obj, ident)
        if hasattr(cur, "__len__") and not isinstance(cur, (str, bytes)) and not isinstance(value, str):
            try:
                if len(cur) == len(value):
                    cur[:] = value
                    return True
            except Exception:
                pass
        setattr(obj, ident, value)
        return True
    except Exception:
        return False


def _resolve_socket(node: Any, collection: Any, ref: dict[str, Any]) -> Any | None:
    ident = ref.get("identifier")
    if ident:
        for sock in collection:
            if getattr(sock, "identifier", None) == ident:
                return sock
    name = ref.get("name")
    if name:
        found = collection.get(name)
        if found is not None:
            return found
        for sock in collection:
            if sock.name == name:
                return sock
    index = ref.get("index")
    if isinstance(index, int) and 0 <= index < len(collection):
        return collection[index]
    return None


def _group_order(trees: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id = {t["id"]: t for t in trees if not t.get("is_root")}
    deps: dict[str, set[str]] = {tid: set() for tid in by_id}
    for tree in by_id.values():
        for node in tree.get("nodes") or []:
            gid = node.get("group_tree_id")
            if gid and gid in by_id and gid != tree["id"]:
                deps[tree["id"]].add(gid)
    ordered: list[dict[str, Any]] = []
    remaining = set(by_id)
    while remaining:
        ready = [tid for tid in remaining if deps[tid] <= (set(by_id) - remaining)]
        if not ready:
            ready = [next(iter(remaining))]
        for tid in ready:
            remaining.remove(tid)
            ordered.append(by_id[tid])
    return ordered


def _apply_ramp(ramp: Any, widget: dict[str, Any], skips: list[Skip], target: str) -> None:
    _assign(ramp, "color_mode", widget.get("color_mode"))
    _assign(ramp, "interpolation", widget.get("interpolation"))
    if "hue_interpolation" in widget:
        _assign(ramp, "hue_interpolation", widget["hue_interpolation"])
    elements = list(widget.get("elements") or [])
    want = len(elements)
    try:
        while len(ramp.elements) < want:
            pos = elements[len(ramp.elements)]["position"] if len(ramp.elements) < want else 0.5
            ramp.elements.new(float(pos))
        while len(ramp.elements) > max(want, 1):
            ramp.elements.remove(ramp.elements[-1])
    except Exception as exc:
        skips.append(Skip(target, f"property missing ({exc})"))
        return
    for i, spec in enumerate(elements):
        if i >= len(ramp.elements):
            break
        el = ramp.elements[i]
        try:
            el.position = float(spec["position"])
            el.color = spec["color"]
        except Exception:
            skips.append(Skip(f"{target}.ramp[{i}]", "property missing"))


def _apply_curves(mapping: Any, widget: dict[str, Any], skips: list[Skip], target: str) -> None:
    _assign(mapping, "use_clip", widget.get("use_clip"))
    for key in ("clip_min_x", "clip_min_y", "clip_max_x", "clip_max_y", "extend"):
        if key in widget:
            _assign(mapping, key, widget[key])
    for ci, curve_spec in enumerate(widget.get("curves") or []):
        if ci >= len(mapping.curves):
            break
        curve = mapping.curves[ci]
        points = list(curve_spec.get("points") or [])
        try:
            while len(curve.points) < len(points):
                loc = points[len(curve.points)]["location"]
                curve.points.new(float(loc[0]), float(loc[1]))
            while len(curve.points) > max(len(points), 2):
                curve.points.remove(curve.points[-1])
        except Exception as exc:
            skips.append(Skip(target, f"property missing ({exc})"))
            continue
        for pi, spec in enumerate(points):
            if pi >= len(curve.points):
                break
            pt = curve.points[pi]
            try:
                pt.location = spec["location"]
                pt.handle_type = spec.get("handle_type", "AUTO")
            except Exception:
                skips.append(Skip(f"{target}.curve[{ci}].{pi}", "property missing"))


def _apply_widgets(node: Any, widgets: dict[str, Any], skips: list[Skip], node_id: str) -> None:
    for ident, widget in (widgets or {}).items():
        if not isinstance(widget, dict):
            continue
        if ident == "image" or ("filepath" in widget and "name" in widget and "elements" not in widget):
            name = widget.get("name") or ""
            image = bpy.data.images.get(name) if name else None
            if image is None:
                skips.append(Skip(name or node_id, "image not in this file"))
                continue
            if not _assign(node, ident if ident != "image" else "image", image):
                skips.append(Skip(name, "image not in this file"))
            continue
        target = getattr(node, ident, None)
        if target is None:
            skips.append(Skip(f"{node_id}.{ident}", "property missing"))
            continue
        if "elements" in widget:
            _apply_ramp(target, widget, skips, f"{node_id}.{ident}")
        elif "curves" in widget:
            _apply_curves(target, widget, skips, f"{node_id}.{ident}")


def _apply_socket_values(node: Any, sockets: dict[str, Any], skips: list[Skip], node_id: str) -> None:
    for side, coll in (("inputs", node.inputs), ("outputs", node.outputs)):
        for spec in sockets.get(side, []) or []:
            live = _resolve_socket(node, coll, spec)
            if live is None:
                skips.append(Skip(spec.get("identifier") or spec.get("name") or node_id, "unknown socket"))
                continue
            if "default_value" in spec and hasattr(live, "default_value"):
                if not _assign(live, "default_value", spec["default_value"]):
                    skips.append(Skip(spec.get("identifier") or node_id, "property missing"))
            if "hide" in spec:
                _assign(live, "hide", spec["hide"])
            if "hide_value" in spec:
                _assign(live, "hide_value", spec["hide_value"])
            if "enabled" in spec:
                _assign(live, "enabled", spec["enabled"])


def _apply_interface(tree: Any, items: list[dict[str, Any]], skips: list[Skip]) -> None:
    iface = getattr(tree, "interface", None)
    if iface is None or not items:
        return
    created: dict[str, Any] = {}
    for spec in items:
        ident = spec.get("identifier") or ""
        name = spec.get("name") or "Item"
        item_type = spec.get("item_type") or "SOCKET"
        parent = created.get(spec.get("parent_identifier") or "")
        try:
            if item_type == "PANEL":
                kwargs: dict[str, Any] = {"name": name}
                if parent is not None:
                    kwargs["parent"] = parent
                live = iface.new_panel(**kwargs)
            else:
                in_out = spec.get("in_out") or "INPUT"
                socket_type = spec.get("socket_type") or "NodeSocketFloat"
                kwargs = {"name": name, "in_out": in_out, "socket_type": socket_type}
                if parent is not None:
                    kwargs["parent"] = parent
                live = iface.new_socket(**kwargs)
        except Exception as exc:
            skips.append(Skip(name, f"unknown socket ({exc})"))
            continue
        created[ident] = live
        if spec.get("description"):
            _assign(live, "description", spec["description"])
        if "default_value" in spec:
            _assign(live, "default_value", spec["default_value"])
        if "min" in spec:
            _assign(live, "min_value", spec["min"])
        if "max" in spec:
            _assign(live, "max_value", spec["max"])
        if "hide_value" in spec:
            _assign(live, "hide_value", spec["hide_value"])


def _set_properties(node: Any, rec: dict[str, Any], affects: set[str], skips: list[Skip]) -> None:
    props = dict(rec.get("properties") or {})
    node_id = rec.get("id") or rec.get("bl_idname") or "?"
    rna = node.bl_rna.properties

    def apply_one(ident: str, value: Any) -> None:
        if ident in _SKIP_PROPS:
            return
        if ident not in rna:
            skips.append(Skip(f"{node_id}.{ident}", "property missing"))
            return
        if not _assign(node, ident, value):
            skips.append(Skip(f"{node_id}.{ident}", "property missing"))

    first = [k for k in props if k in affects]
    rest = [k for k in props if k not in affects]
    for ident in first:
        apply_one(ident, props[ident])
    for ident in rest:
        apply_one(ident, props[ident])


def _fill_tree(
    tree: Any,
    payload_tree: dict[str, Any],
    *,
    shift: tuple[float, float],
    groups: dict[str, Any],
    affects_map: dict[str, set[str]] | None,
    result: PasteResult,
    select: bool,
) -> None:
    nodes_spec = list(payload_tree.get("nodes") or [])
    id_map: dict[str, Any] = {}
    remaining = {n["id"]: n for n in nodes_spec}

    def create_one(rec: dict[str, Any]) -> Any | None:
        nid = rec["id"]
        if nid in id_map:
            return id_map[nid]
        bl_idname = rec["bl_idname"]
        before = {n.as_pointer() for n in tree.nodes}
        try:
            live = tree.nodes.new(bl_idname)
        except Exception:
            result.skips.append(Skip(bl_idname, "unknown type"))
            remaining.pop(nid, None)
            return None
        id_map[nid] = live
        remaining.pop(nid, None)
        result.nodes += 1
        if select:
            result.created.append(live)
        after = [n for n in tree.nodes if n.as_pointer() not in before and n != live]
        pair_id = rec.get("zone_pair_id")
        if pair_id and after and pair_id in remaining:
            partner_spec = remaining[pair_id]
            adopted = next((n for n in after if n.bl_idname == partner_spec["bl_idname"]), None)
            if adopted is not None:
                id_map[pair_id] = adopted
                remaining.pop(pair_id, None)
                result.nodes += 1
        gid = rec.get("group_tree_id")
        if gid and gid in groups and live.bl_idname in _GROUP_BL:
            try:
                live.node_tree = groups[gid]
            except Exception:
                result.skips.append(Skip(nid, "property missing"))
        return live

    zone_inputs = [
        rec
        for rec in nodes_spec
        if rec.get("zone_pair_id") and rec.get("bl_idname", "").endswith("Input")
    ]
    for rec in zone_inputs:
        create_one(rec)
    for rec in list(remaining.values()):
        create_one(rec)

    for rec in nodes_spec:
        live = id_map.get(rec["id"])
        if live is None:
            continue
        flagged = set(affects_map.get(rec["bl_idname"]) or ()) if affects_map else set()
        _set_properties(live, rec, flagged, result.skips)
        _apply_widgets(live, rec.get("widgets") or {}, result.skips, rec["id"])
        _apply_socket_values(live, rec.get("sockets") or {}, result.skips, rec["id"])

    for rec in nodes_spec:
        live = id_map.get(rec["id"])
        if live is None:
            continue
        parent_id = rec.get("parent_id")
        if parent_id:
            parent = id_map.get(parent_id)
            if parent is not None:
                try:
                    live.parent = parent
                except Exception:
                    result.skips.append(Skip(rec["id"], "property missing"))
        loc = rec.get("location") or [0, 0]
        if not parent_id:
            live.location = (float(loc[0]) + shift[0], float(loc[1]) + shift[1])
        else:
            live.location = (float(loc[0]), float(loc[1]))
        if rec.get("width") is not None:
            _assign(live, "width", rec["width"])
        if rec.get("bl_idname") == "NodeFrame":
            if rec.get("height") is not None:
                _assign(live, "height", rec["height"])
            if rec.get("label_size") is not None:
                _assign(live, "label_size", rec["label_size"])
            if "shrink" in rec:
                _assign(live, "shrink", rec["shrink"])
            if rec.get("text") is not None:
                _assign(live, "text", rec["text"])
        _assign(live, "label", rec.get("label") or "")
        _assign(live, "mute", rec.get("mute"))
        _assign(live, "hide", rec.get("hide"))
        _assign(live, "hide_unused_sockets", rec.get("hide_unused_sockets"))
        _assign(live, "use_custom_color", rec.get("use_custom_color"))
        if rec.get("use_custom_color") and rec.get("color"):
            _assign(live, "color", rec["color"])

    for link in payload_tree.get("links") or []:
        src = id_map.get(link.get("from_node"))
        dst = id_map.get(link.get("to_node"))
        if src is None or dst is None:
            result.skips.append(Skip(link.get("id") or "link", "unknown socket"))
            continue
        from_s = _resolve_socket(src, src.outputs, link.get("from_socket") or {})
        to_s = _resolve_socket(dst, dst.inputs, link.get("to_socket") or {})
        if from_s is None or to_s is None:
            ident = (link.get("from_socket") or {}).get("identifier") or (link.get("to_socket") or {}).get("identifier")
            result.skips.append(Skip(ident or link.get("id") or "link", "unknown socket"))
            continue
        try:
            live_link = tree.links.new(from_s, to_s)
            if link.get("is_muted") and hasattr(live_link, "is_muted"):
                live_link.is_muted = True
            result.links += 1
        except Exception:
            result.skips.append(Skip(link.get("id") or "link", "unknown socket"))

    pasted = set(id_map.values())
    taken = {n.name for n in tree.nodes if n not in pasted}
    for rec in nodes_spec:
        live = id_map.get(rec["id"])
        if live is None:
            continue
        want = rec.get("name") or ""
        if not want or want == live.name:
            continue
        if want in taken:
            continue
        try:
            live.name = want
            taken.add(want)
        except Exception:
            pass


def paste_payload(
    tree: Any,
    payload: dict[str, Any],
    *,
    cursor: tuple[float, float] | Any,
    editor_tree_type: str | None = None,
    replace: bool = False,
) -> PasteResult:
    """Create nodes in ``tree`` from a validated payload. Mutates ``last_skips``."""
    copied_type = payload.get("tree_type")
    if editor_tree_type and copied_type != editor_tree_type:
        raise TreeTypeMismatch(str(copied_type), editor_tree_type)
    clear_skips()

    if replace:
        tree.nodes.clear()
        shift = (0.0, 0.0)
    else:
        origin = payload.get("origin") or {}
        center = origin.get("selection_center") or [0, 0]
        cx, cy = float(cursor[0]), float(cursor[1])
        shift = (cx - float(center[0]), cy - float(center[1]))

    trees = list(payload.get("trees") or [])
    root = next((t for t in trees if t.get("is_root")), trees[0] if trees else None)
    if root is None:
        return PasteResult()

    raw_ver = payload.get("blender_version") or bpy.app.version[:3]
    version = tuple(int(x) for x in raw_ver)
    affects = load_affects_map(version) or {}
    result = PasteResult()
    groups: dict[str, Any] = {}

    for spec in _group_order(trees):
        name = spec.get("name") or "NodeGroup"
        gtree = bpy.data.node_groups.new(name, payload["tree_type"])
        groups[spec["id"]] = gtree
        _clear_group_defaults(gtree)
        _apply_interface(gtree, spec.get("interface") or [], result.skips)
        _fill_tree(
            gtree,
            spec,
            shift=(0.0, 0.0),
            groups=groups,
            affects_map=affects,
            result=result,
            select=False,
        )
    _fill_tree(
        tree,
        root,
        shift=shift,
        groups=groups,
        affects_map=affects,
        result=result,
        select=True,
    )
    for node in tree.nodes:
        node.select = False
    for node in result.created:
        node.select = True
    if result.created:
        tree.nodes.active = result.created[0]

    last_skips[:] = list(result.skips)
    return result


def _clear_group_defaults(tree: Any) -> None:
    try:
        tree.nodes.clear()
    except Exception:
        pass
    iface = getattr(tree, "interface", None)
    if iface is None:
        return
    try:
        for item in list(getattr(iface, "items_tree", []) or []):
            try:
                iface.remove(item)
            except Exception:
                pass
    except Exception:
        pass
