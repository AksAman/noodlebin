"""Extract a NodeVault catalog from the running Blender binary.

Release command (from v2/, against that version's blender):

    blender --background --factory-startup --python scripts/extract_node_catalog.py -- --out catalog/versions

Writes catalog/versions/<blender_version_string>/catalog.json and exits 0.
Owned by docs/pid/06-node-catalog.md. No application code change is required
for a node the generic view can draw.
"""

from __future__ import annotations

import argparse
import inspect
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from catalog_schema import (  # noqa: E402
    PROPERTY_DENYLIST,
    TREE_TYPES,
    UNRESOLVED_SOCKET_COLOR,
    catalog_json,
    header_color_key,
    is_denied_property,
    is_pair_property_name,
    parse_draw_menu_paths,
    parse_menu_contents_ids,
    parse_node_types_from_source,
    parse_tree_type_add_menus,
    parse_zone_calls,
    parse_zone_pairs_from_assignments,
    version_dirname,
    widget_id,
)

try:
    import bpy
except ImportError as exc:  # pragma: no cover - exercised only under Blender
    raise SystemExit(
        "extract_node_catalog.py must be run inside Blender:\n"
        "  blender --background --factory-startup --python "
        "scripts/extract_node_catalog.py -- --out catalog/versions"
    ) from exc


THROWAY_PREFIX = "_nodevault_catalog"
KNOWN_WIDGET_STRUCTS = frozenset(
    {
        "ColorRamp",
        "CurveMapping",
        "Image",
        "ImageUser",
        "Node",
        "NodeTree",
        "Text",
        "Struct",
    }
)
# Data-block pointers are pickers, not new widget kinds. Mapping/format
# structs we do not already draw are the ones stdout should mention.
DATABLOCK_STRUCTS = frozenset(
    {
        "Scene",
        "Object",
        "Collection",
        "Material",
        "MovieClip",
        "Mask",
        "Image",
        "Text",
        "Node",
        "NodeTree",
        "Font",
        "Sound",
        "CacheFile",
        "ColorManagedDisplaySettings",
        "ColorManagedViewSettings",
    }
)
ABSTRACT_NODE_TYPES = frozenset(
    {
        "Node",
        "ShaderNode",
        "GeometryNode",
        "CompositorNode",
        "FunctionNode",
        "TextureNode",
    }
)


def _now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _rna_id(fixed_type: Any) -> str | None:
    if fixed_type is None:
        return None
    return getattr(fixed_type, "identifier", None) or getattr(fixed_type, "name", None)


def _as_float_list(value: Any) -> list[float] | None:
    if value is None or isinstance(value, (str, bytes)):
        return None
    try:
        return [float(x) for x in list(value)]
    except (TypeError, ValueError):
        return None


def _json_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, int) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, float):
        return float(value)
    floats = _as_float_list(value)
    if floats is not None:
        return floats
    return None


# --- themes -----------------------------------------------------------------


def extract_themes() -> tuple[dict[str, list[float]], str]:
    prefs = getattr(bpy.context, "preferences", None)
    theme_source = "factory" if "--factory-startup" in sys.argv else "binary"
    if prefs is None or not getattr(prefs, "themes", None):
        return {}, "source"
    try:
        node_editor = prefs.themes[0].node_editor
    except (IndexError, AttributeError):
        return {}, "source"
    themes: dict[str, list[float]] = {}
    for prop in node_editor.bl_rna.properties:
        ident = prop.identifier
        if ident.startswith("rna_") or ident in PROPERTY_DENYLIST:
            continue
        if prop.type != "FLOAT":
            continue
        raw = getattr(node_editor, ident, None)
        color = _as_float_list(raw)
        if color is None:
            continue
        themes[ident] = color
    return themes, theme_source


# --- menus / categories -----------------------------------------------------


def _source(obj: Any) -> str:
    try:
        return inspect.getsource(obj)
    except (OSError, TypeError):
        return ""


def discover_root_menus() -> dict[str, str]:
    add = getattr(bpy.types, "NODE_MT_add", None)
    if add is None:
        return {}
    return parse_tree_type_add_menus(_source(add.draw))


def _menu_class(bl_idname: str) -> Any | None:
    cls = getattr(bpy.types, bl_idname, None)
    if cls is not None:
        return cls
    for name in dir(bpy.types):
        cand = getattr(bpy.types, name)
        if getattr(cand, "bl_idname", None) == bl_idname:
            return cand
    return None


def walk_add_menus(tree_type: str, root_id: str) -> tuple[list[dict[str, Any]], list[tuple[str, str]]]:
    """Walk the Shift+A add menus for one tree type.

    Returns category records and zone pairs mentioned by those menus.
    Swap menus are skipped: we only follow the add-all root.
    """
    categories: list[dict[str, Any]] = []
    zone_pairs: list[tuple[str, str]] = []
    seen_menus: set[str] = set()

    def add_zone_pair(pair: tuple[str, str]) -> None:
        if pair not in zone_pairs:
            zone_pairs.append(pair)

    def visit(menu_id: str, pathing: dict[str, str] | None) -> None:
        if menu_id in seen_menus:
            return
        seen_menus.add(menu_id)
        cls = _menu_class(menu_id)
        if cls is None:
            return
        cls_name = type(cls).__name__ if not isinstance(cls, type) else cls.__name__
        # Skip swap variants if we landed on one by accident.
        if "swap" in menu_id.lower() or "Swap" in cls_name:
            return
        menu_pathing = getattr(cls, "pathing_dict", None) or pathing or {}
        draw = getattr(cls, "draw", None)
        source = _source(draw) if draw is not None else ""
        nodes = parse_node_types_from_source(source)
        for pair in parse_zone_calls(source):
            add_zone_pair(pair)
            for ident in pair:
                if ident not in nodes:
                    nodes.append(ident)
        label = getattr(cls, "bl_label", None) or menu_id
        if nodes:
            categories.append(
                {
                    "tree_type": tree_type,
                    "id": getattr(cls, "bl_idname", menu_id) or menu_id,
                    "label": label,
                    "nodes": nodes,
                }
            )
        for sub_path in parse_draw_menu_paths(source):
            sub_id = menu_pathing.get(sub_path)
            if sub_id:
                visit(sub_id, menu_pathing)
        for sub_id in parse_menu_contents_ids(source):
            visit(sub_id, menu_pathing)

    visit(root_id, None)
    return categories, zone_pairs


def fallback_subclasses(tree_type: str) -> list[str]:
    bases: list[Any] = []
    if tree_type == "ShaderNodeTree":
        bases.append(getattr(bpy.types, "ShaderNode", None))
    elif tree_type == "GeometryNodeTree":
        bases.extend(
            [
                getattr(bpy.types, "GeometryNode", None),
                getattr(bpy.types, "FunctionNode", None),
            ]
        )
    elif tree_type == "CompositorNodeTree":
        bases.append(getattr(bpy.types, "CompositorNode", None))
    shared = [
        getattr(bpy.types, name, None)
        for name in (
            "NodeFrame",
            "NodeReroute",
            "NodeGroupInput",
            "NodeGroupOutput",
            "ShaderNodeGroup",
            "GeometryNodeGroup",
            "CompositorNodeGroup",
        )
    ]
    found: list[str] = []
    for base in [*bases, *shared]:
        if base is None:
            continue
        for name in dir(bpy.types):
            cls = getattr(bpy.types, name)
            if not isinstance(cls, type):
                continue
            try:
                ok = cls is base or issubclass(cls, base)
            except TypeError:
                continue
            if not ok:
                continue
            bid = getattr(cls, "bl_idname", None) or name
            if bid in ABSTRACT_NODE_TYPES:
                continue
            if bid not in found:
                found.append(bid)
    return found


# --- sockets / properties / widgets -----------------------------------------


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
    json_default = _json_value(default) if default is not None else None
    if json_default is not None:
        rec["default_value"] = json_default
    return rec


def _socket_ids(node: Any) -> tuple[tuple[Any, ...], tuple[Any, ...]]:
    """Layout fingerprint. Identifiers alone are not enough: Switch keeps
    False/True and changes bl_idname; Math keeps Value_* and flips enabled.
    """
    inputs = tuple((s.identifier, s.bl_idname, bool(getattr(s, "enabled", True))) for s in node.inputs)
    outputs = tuple((s.identifier, s.bl_idname, bool(getattr(s, "enabled", True))) for s in node.outputs)
    return inputs, outputs


def _read_socket_color(socket: Any) -> list[float] | None:
    fn = getattr(socket, "draw_color_simple", None)
    if callable(fn):
        try:
            color = _as_float_list(fn())
            if color:
                return color
        except Exception:
            pass
    return None


def _property_type_name(prop: Any, value: Any) -> str:
    rna_type = prop.type
    array_length = int(getattr(prop, "array_length", 0) or 0)
    if rna_type == "FLOAT" and array_length > 1:
        return "FLOAT_ARRAY"
    if rna_type in {"FLOAT", "INT", "BOOLEAN", "ENUM", "STRING", "POINTER"}:
        return rna_type
    if isinstance(value, bool):
        return "BOOLEAN"
    if isinstance(value, int):
        return "INT"
    if isinstance(value, float):
        return "FLOAT"
    if isinstance(value, str):
        return "STRING"
    return rna_type


def _property_limits(prop: Any, rec: dict[str, Any]) -> None:
    for key in ("hard_min", "hard_max", "soft_min", "soft_max", "step", "precision"):
        if not hasattr(prop, key):
            continue
        raw = getattr(prop, key)
        out_key = {"hard_min": "min", "hard_max": "max"}.get(key, key)
        if isinstance(raw, bool):
            continue
        if isinstance(raw, (int, float)):
            rec[out_key] = int(raw) if isinstance(raw, int) and not isinstance(raw, bool) else float(raw)


def _enum_items(prop: Any) -> list[dict[str, str]]:
    items = getattr(prop, "enum_items_static", None) or getattr(prop, "enum_items", None) or []
    out: list[dict[str, str]] = []
    for item in items:
        out.append({"identifier": item.identifier, "name": item.name})
    return out


def classify_node_widgets(node: Any) -> tuple[bool, bool, bool, str | None, list[str]]:
    has_ramp = False
    has_curve = False
    has_image = False
    pair_property = None
    hints: list[str] = []
    for prop in node.bl_rna.properties:
        ident = prop.identifier
        if ident.startswith("rna_"):
            continue
        if is_pair_property_name(ident):
            pair_property = ident
        fixed = _rna_id(getattr(prop, "fixed_type", None))
        try:
            value = getattr(node, ident)
        except Exception:
            value = None
        type_name = type(value).__name__ if value is not None else (fixed or "")
        if type_name == "ColorRamp" or fixed == "ColorRamp":
            has_ramp = True
        elif type_name == "CurveMapping" or fixed == "CurveMapping":
            has_curve = True
        elif (fixed == "Image" or type_name == "Image") and ident == "image":
            has_image = True
        elif (
            prop.type == "POINTER"
            and fixed
            and fixed not in KNOWN_WIDGET_STRUCTS
            and fixed not in DATABLOCK_STRUCTS
            and not is_denied_property(ident)
            and ident not in {"parent", "paired_output", "paired_input", "active_item", "node_tree"}
        ):
            hints.append(f"{node.bl_idname}.{ident}:{fixed}")
    return has_ramp, has_curve, has_image, pair_property, hints


def probe_affects_sockets(node: Any, prop: Any) -> bool:
    original_sockets = _socket_ids(node)
    ident = prop.identifier
    try:
        original = getattr(node, ident)
    except Exception:
        return False
    changed = False
    try:
        if prop.type == "ENUM":
            for item in _enum_items(prop):
                try:
                    setattr(node, ident, item["identifier"])
                except Exception:
                    continue
                if _socket_ids(node) != original_sockets:
                    changed = True
                    break
        elif prop.type == "BOOLEAN":
            try:
                setattr(node, ident, not bool(original))
            except Exception:
                return False
            changed = _socket_ids(node) != original_sockets
    finally:
        try:
            setattr(node, ident, original)
        except Exception:
            pass
    return changed


def extract_properties(node: Any) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for prop in node.bl_rna.properties:
        ident = prop.identifier
        if is_denied_property(ident):
            continue
        if prop.is_readonly:
            continue
        if prop.type in {"COLLECTION", "POINTER"}:
            continue
        try:
            value = getattr(node, ident)
        except Exception:
            continue
        rec: dict[str, Any] = {
            "identifier": ident,
            "type": _property_type_name(prop, value),
            "affects_sockets": False,
        }
        default = _json_value(value)
        if default is not None or value is None:
            rec["default"] = default
        if prop.type == "ENUM":
            rec["enum_items"] = _enum_items(prop)
        array_length = int(getattr(prop, "array_length", 0) or 0)
        if array_length > 1:
            rec["array_length"] = array_length
        _property_limits(prop, rec)
        if prop.type in {"ENUM", "BOOLEAN"}:
            rec["affects_sockets"] = probe_affects_sockets(node, prop)
        records.append(rec)
    return records


def rna_bases(node: Any) -> list[str]:
    names: list[str] = []
    rna = getattr(node, "bl_rna", None)
    while rna is not None:
        ident = getattr(rna, "identifier", None)
        if ident and ident not in names:
            names.append(ident)
        rna = getattr(rna, "base", None)
    return names


# --- extraction of one node -------------------------------------------------


def extract_one_node(
    tree: Any,
    bl_idname: str,
    tree_type: str,
    theme_keys: list[str],
    zone_lookup: dict[str, str],
    socket_colors: dict[str, list[float]],
    unresolved: set[str],
    hints: list[str],
) -> tuple[dict[str, Any] | None, str | None]:
    before = {n.as_pointer() for n in tree.nodes}
    try:
        node = tree.nodes.new(bl_idname)
    except Exception as exc:
        return None, str(exc).strip() or type(exc).__name__

    created = [n for n in tree.nodes if n.as_pointer() not in before]
    extras = [n for n in created if n != node]
    auto_pair = extras[0].bl_idname if extras else None
    if auto_pair and zone_lookup.get(bl_idname) is None:
        zone_lookup[bl_idname] = auto_pair
        zone_lookup[auto_pair] = bl_idname

    try:
        has_ramp, has_curve, has_image, pair_property, node_hints = classify_node_widgets(node)
        hints.extend(node_hints)
        is_zone = bool(pair_property or auto_pair or bl_idname in zone_lookup)
        record: dict[str, Any] = {
            "bl_idname": node.bl_idname,
            "label": node.bl_label,
            "description": getattr(node.bl_rna, "description", "") or "",
            "tree_types": [tree_type],
            "category_id": None,
            "header_color": header_color_key(
                color_tag=getattr(node, "color_tag", None),
                rna_bases=rna_bases(node),
                bl_idname=node.bl_idname,
                theme_keys=theme_keys,
            ),
            "width_default": float(node.width),
            "inputs": [],
            "outputs": [],
            "properties": extract_properties(node),
            "widget": widget_id(
                bl_idname=node.bl_idname,
                has_color_ramp=has_ramp,
                has_curve_mapping=has_curve,
                has_image=has_image,
                is_zone=is_zone,
            ),
        }
        if auto_pair:
            record["auto_creates_pair"] = auto_pair
        if pair_property:
            record["pair_property"] = pair_property
        for i, socket in enumerate(node.inputs):
            rec = _socket_record(socket, i)
            if rec:
                record["inputs"].append(rec)
                _note_socket_color(socket, rec["bl_idname"], socket_colors, unresolved)
        for i, socket in enumerate(node.outputs):
            rec = _socket_record(socket, i)
            if rec:
                record["outputs"].append(rec)
                _note_socket_color(socket, rec["bl_idname"], socket_colors, unresolved)
        return record, None
    finally:
        remaining = list(tree.nodes)
        for leftover in remaining:
            try:
                tree.nodes.remove(leftover)
            except Exception:
                pass


def _note_socket_color(
    socket: Any,
    bl_idname: str,
    socket_colors: dict[str, list[float]],
    unresolved: set[str],
) -> None:
    if bl_idname in socket_colors:
        return
    color = _read_socket_color(socket)
    if color:
        socket_colors[bl_idname] = color
        unresolved.discard(bl_idname)
        return
    socket_colors[bl_idname] = list(UNRESOLVED_SOCKET_COLOR)
    unresolved.add(bl_idname)


# --- trees / cleanup --------------------------------------------------------


def new_throwaway(tree_type: str) -> Any:
    name = f"{THROWAY_PREFIX}_{tree_type}"
    existing = bpy.data.node_groups.get(name)
    if existing is not None:
        bpy.data.node_groups.remove(existing)
    return bpy.data.node_groups.new(name, tree_type)


def cleanup(created_names: set[str]) -> None:
    for ng in list(bpy.data.node_groups):
        if ng.name.startswith(THROWAY_PREFIX) or ng.name in created_names:
            try:
                bpy.data.node_groups.remove(ng)
            except Exception:
                pass
    for coll_name in ("images", "materials", "meshes", "objects"):
        coll = getattr(bpy.data, coll_name, None)
        if coll is None:
            continue
        for item in list(coll):
            if item.name.startswith(THROWAY_PREFIX):
                try:
                    coll.remove(item)
                except Exception:
                    pass


def collect_zone_pairs_from_binary() -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for name in dir(bpy.types):
        cls = getattr(bpy.types, name)
        for attr in ("simulation_zone", "repeat_zone", "for_each_element_zone", "closure_zone"):
            fn = getattr(cls, attr, None)
            if fn is None:
                continue
            for pair in parse_zone_pairs_from_assignments(_source(fn)):
                if pair not in pairs:
                    pairs.append(pair)
    return pairs


# --- main -------------------------------------------------------------------


def extract_catalog() -> dict[str, Any]:
    themes, theme_source = extract_themes()
    theme_keys = list(themes)
    root_menus = discover_root_menus()
    socket_colors: dict[str, list[float]] = {}
    unresolved: set[str] = set()
    hints: list[str] = []
    failed: dict[str, str] = {}
    nodes: dict[str, dict[str, Any]] = {}
    categories: list[dict[str, Any]] = []
    first_category: dict[str, str] = {}
    zone_lookup: dict[str, str] = {}
    created_names: set[str] = set()

    for a, b in collect_zone_pairs_from_binary():
        zone_lookup[a] = b
        zone_lookup[b] = a

    listed_by_tree: dict[str, list[str]] = {tt: [] for tt in TREE_TYPES}

    for tree_type in TREE_TYPES:
        root = root_menus.get(tree_type)
        if root:
            cats, pairs = walk_add_menus(tree_type, root)
            categories.extend(cats)
            for a, b in pairs:
                zone_lookup[a] = b
                zone_lookup[b] = a
            for cat in cats:
                for bid in cat["nodes"]:
                    first_category.setdefault(bid, cat["id"])
                    if bid not in listed_by_tree[tree_type]:
                        listed_by_tree[tree_type].append(bid)
        for bid in fallback_subclasses(tree_type):
            if bid not in listed_by_tree[tree_type]:
                listed_by_tree[tree_type].append(bid)

    for tree_type in TREE_TYPES:
        tree = new_throwaway(tree_type)
        created_names.add(tree.name)
        seen_this_tree: set[str] = set()
        uncategorized: list[str] = []
        for bl_idname in listed_by_tree[tree_type]:
            if bl_idname in seen_this_tree or bl_idname in ABSTRACT_NODE_TYPES:
                continue
            seen_this_tree.add(bl_idname)
            if bl_idname in nodes:
                try:
                    tmp = tree.nodes.new(bl_idname)
                    try:
                        tree.nodes.remove(tmp)
                    except Exception:
                        tree.nodes.clear()
                    if tree_type not in nodes[bl_idname]["tree_types"]:
                        nodes[bl_idname]["tree_types"].append(tree_type)
                except Exception:
                    pass
                continue
            record, error = extract_one_node(
                tree,
                bl_idname,
                tree_type,
                theme_keys,
                zone_lookup,
                socket_colors,
                unresolved,
                hints,
            )
            if error is not None:
                failed[bl_idname] = error
                continue
            failed.pop(bl_idname, None)
            assert record is not None
            record["category_id"] = first_category.get(bl_idname)
            if record["category_id"] is None:
                uncategorized.append(bl_idname)
                record["category_id"] = "UNCATEGORIZED"
            # If this version auto-created a pair, stamp both ends.
            pair = record.get("auto_creates_pair")
            if pair:
                zone_lookup[record["bl_idname"]] = pair
                zone_lookup[pair] = record["bl_idname"]
            nodes[record["bl_idname"]] = record
        if uncategorized:
            categories.append(
                {
                    "tree_type": tree_type,
                    "id": "UNCATEGORIZED",
                    "label": "Uncategorized",
                    "nodes": uncategorized,
                }
            )

    # Zone widget / auto_creates_pair after every node is known.
    for bid, partner in zone_lookup.items():
        rec = nodes.get(bid)
        if rec is None:
            continue
        rec["widget"] = widget_id(
            bl_idname=bid,
            has_color_ramp=rec["widget"] == "color_ramp",
            has_curve_mapping=rec["widget"] == "curve_mapping",
            has_image=rec["widget"] == "image",
            is_zone=True,
        )
        partner_rec = nodes.get(partner)
        if rec.get("auto_creates_pair") is None and partner_rec is not None:
            # Only claim auto-create when we observed it at nodes.new time.
            pass

    cleanup(created_names)
    skipped = [
        {"bl_idname": bid, "error": err}
        for bid, err in sorted(failed.items())
        if bid not in nodes
    ]
    unique_hints = sorted(set(hints))
    return {
        "blender_version": [int(x) for x in bpy.app.version],
        "blender_version_string": bpy.app.version_string,
        "extracted_at": _now_utc(),
        "theme_source": theme_source,
        "themes": themes,
        "socket_colors": socket_colors,
        "socket_colors_unresolved": sorted(unresolved),
        "categories": categories,
        "nodes": nodes,
        "skipped": skipped,
        "_new_widget_hints": unique_hints,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    args = argv
    if "--" in args:
        args = args[args.index("--") + 1 :]
    parser = argparse.ArgumentParser(description="Extract a NodeVault node catalog from this Blender.")
    parser.add_argument(
        "--out",
        default=str(ROOT / "catalog" / "versions"),
        help="Directory that will contain <version>/catalog.json",
    )
    return parser.parse_args(args)


def main(argv: list[str] | None = None) -> int:
    ns = parse_args(sys.argv if argv is None else argv)
    out_root = Path(ns.out)
    if not out_root.is_absolute():
        out_root = (Path.cwd() / out_root).resolve()
    try:
        catalog = extract_catalog()
    except Exception:
        traceback.print_exc()
        return 1
    hints = catalog.pop("_new_widget_hints", [])
    text = catalog_json(catalog)
    dest_dir = out_root / version_dirname(catalog["blender_version_string"])
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "catalog.json"
    dest.write_text(text, encoding="utf-8")

    nodes = catalog["nodes"]
    tree_counts = {tt: 0 for tt in TREE_TYPES}
    for rec in nodes.values():
        for tt in rec["tree_types"]:
            if tt in tree_counts:
                tree_counts[tt] += 1
    print(
        f"extracted nodes={len(nodes)} "
        f"shader={tree_counts['ShaderNodeTree']} "
        f"geometry={tree_counts['GeometryNodeTree']} "
        f"compositor={tree_counts['CompositorNodeTree']} "
        f"categories={len(catalog['categories'])} "
        f"skipped={len(catalog['skipped'])} "
        f"themes={len(catalog['themes'])} "
        f"socket_colors={len(catalog['socket_colors'])}"
    )
    if hints:
        print("new_widget_hints:")
        for hint in hints:
            print(f"  {hint}")
    else:
        print("new_widget_hints: (none)")
    print(f"wrote {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
