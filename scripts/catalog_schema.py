"""Pure helpers for the node catalog. No bpy.

Owned by docs/pid/06-node-catalog.md. The extractor imports these; tests
import them under plain python3. Blender-facing work lives in
extract_node_catalog.py.
"""

from __future__ import annotations

import json
import re
from typing import Any, Iterable, Mapping

CATALOG_KEYS = (
    "blender_version",
    "blender_version_string",
    "extracted_at",
    "theme_source",
    "themes",
    "socket_colors",
    "socket_colors_unresolved",
    "categories",
    "nodes",
    "skipped",
)

CATEGORY_KEYS = ("tree_type", "id", "label", "nodes")

NODE_RECORD_KEYS = (
    "bl_idname",
    "label",
    "description",
    "tree_types",
    "category_id",
    "header_color",
    "width_default",
    "inputs",
    "outputs",
    "properties",
    "widget",
    "auto_creates_pair",
    "pair_property",
)

PROPERTY_KEYS = (
    "identifier",
    "type",
    "default",
    "enum_items",
    "min",
    "max",
    "soft_min",
    "soft_max",
    "step",
    "precision",
    "affects_sockets",
    "array_length",
)

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

ENUM_ITEM_KEYS = ("identifier", "name")
SKIPPED_KEYS = ("bl_idname", "error")

# RNA identifiers the catalog never treats as settable properties.
PROPERTY_DENYLIST = frozenset(
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
    }
)

WIDGET_IDS = (
    "color_ramp",
    "curve_mapping",
    "image",
    "frame",
    "reroute",
    "group",
    "zone",
    "generic",
)

# Blender's node color_tag → ThemeNodeEditor field. Keys that a given
# version does not have on the theme fall back at extract time.
COLOR_TAG_TO_THEME = {
    "NONE": "layout_node",
    "ATTRIBUTE": "attribute_node",
    "COLOR": "color_node",
    "CONVERTER": "converter_node",
    "DISTORT": "distor_node",
    "FILTER": "filter_node",
    "GEOMETRY": "geometry_node",
    "INPUT": "input_node",
    "MATTE": "matte_node",
    "OUTPUT": "output_node",
    "SCRIPT": "script_node",
    "SHADER": "shader_node",
    "TEXTURE": "texture_node",
    "VECTOR": "vector_node",
    "PATTERN": "texture_node",
    "INTERFACE": "group_socket_node",
    "GROUP": "group_node",
}

# RNA base class → theme field, used when color_tag is missing or NONE
# and the class is unambiguous. compositor_node is listed because the PID
# names it; a version that has no such theme field falls back later.
RNA_BASE_TO_THEME = {
    "ShaderNode": "shader_node",
    "GeometryNode": "geometry_node",
    "CompositorNode": "compositor_node",
    "TextureNode": "texture_node",
    "FunctionNode": "converter_node",
}

TREE_TYPES = ("ShaderNodeTree", "GeometryNodeTree", "CompositorNodeTree")

# Fallback gray from the catalog PID when a socket color cannot be resolved.
UNRESOLVED_SOCKET_COLOR = [0.63, 0.63, 0.63]

# Zone operator helpers in this binary's add-menu Python. The identifiers
# are read from source at extract time; these names are how we find the
# assignments, not a previous release's node list.
ZONE_METHOD_TO_SOURCE_ATTR = {
    "simulation_zone": ("GeometryNodeSimulationInput", "GeometryNodeSimulationOutput"),
    "repeat_zone": ("GeometryNodeRepeatInput", "GeometryNodeRepeatOutput"),
    "for_each_element_zone": (
        "GeometryNodeForeachGeometryElementInput",
        "GeometryNodeForeachGeometryElementOutput",
    ),
    "closure_zone": ("NodeClosureInput", "NodeClosureOutput"),
    "add_simulation_zone": ("GeometryNodeSimulationInput", "GeometryNodeSimulationOutput"),
    "add_repeat_zone": ("GeometryNodeRepeatInput", "GeometryNodeRepeatOutput"),
    "add_foreach_geometry_element_zone": (
        "GeometryNodeForeachGeometryElementInput",
        "GeometryNodeForeachGeometryElementOutput",
    ),
    "add_closure_zone": ("NodeClosureInput", "NodeClosureOutput"),
}

# First quoted identifier in a node_operator / add_node_type call is the bl_idname.
_NODE_TYPE_CALL = re.compile(
    r"""
    (?:self\.)?
    (?:
        node_operator(?:_with_searchable_enum(?:_socket)?|_with_outputs)?
        |
        add_node_type(?:_with_searchable_enum(?:_socket)?|_with_outputs)?
    )
    \s*\(
    [^)"']*?
    ["']([A-Za-z][A-Za-z0-9_]+)["']
    """,
    re.VERBOSE | re.DOTALL,
)

_DRAW_MENU = re.compile(
    r"""(?:self\.)?draw_menu\s*\(\s*layout\s*,\s*(?:path\s*=\s*)?["']([^"']+)["']"""
)

_MENU_CONTENTS = re.compile(
    r"""(?:layout\.)?menu_contents\s*\(\s*["']([A-Za-z][A-Za-z0-9_]+)["']"""
)

_TREE_TO_ADD_ALL = re.compile(
    r"""tree_type\s*==\s*['"](\w+)['"]\s*:
        \s*layout\.menu_contents\(\s*['"](\w+)['"]""",
    re.VERBOSE,
)

_ZONE_CALL = re.compile(
    r"""(?:self\.)?("""
    + "|".join(re.escape(name) for name in ZONE_METHOD_TO_SOURCE_ATTR)
    + r""")\s*\("""
)

_ZONE_ASSIGN = re.compile(
    r"""(?:input_node_type|output_node_type)\s*=\s*["']([A-Za-z][A-Za-z0-9_]+)["']"""
)

_PAIR_PROPERTY_NAMES = frozenset({"paired_output", "paired_input"})


def is_denied_property(identifier: str) -> bool:
    if identifier in PROPERTY_DENYLIST:
        return True
    return identifier.startswith("bl_") or identifier.startswith("_")


def header_color_key(
    *,
    color_tag: str | None,
    rna_bases: Iterable[str],
    bl_idname: str,
    theme_keys: Iterable[str],
) -> str:
    """Pick the ThemeNodeEditor field used to paint this node's header.

    color_tag is what Blender's draw code uses on 4.x/5.x. RNA base class is
    the PID's fallback. NodeFrame prefers frame_node when the theme has it.
    Missing keys become layout_node.
    """
    available = set(theme_keys)
    if bl_idname == "NodeFrame" and "frame_node" in available:
        return "frame_node"
    if color_tag and color_tag != "NONE":
        mapped = COLOR_TAG_TO_THEME.get(color_tag)
        if mapped and mapped in available:
            return mapped
    for base in rna_bases:
        mapped = RNA_BASE_TO_THEME.get(base)
        if mapped and mapped in available:
            return mapped
    if color_tag == "NONE" and "layout_node" in available:
        return "layout_node"
    return "layout_node"


def widget_id(
    *,
    bl_idname: str,
    has_color_ramp: bool,
    has_curve_mapping: bool,
    has_image: bool,
    is_zone: bool,
) -> str:
    """Widget id, in the PID's condition order, with named types winning."""
    if bl_idname == "NodeFrame":
        return "frame"
    if bl_idname == "NodeReroute":
        return "reroute"
    if bl_idname.endswith("NodeGroup"):
        return "group"
    if is_zone:
        return "zone"
    if has_color_ramp:
        return "color_ramp"
    if has_curve_mapping:
        return "curve_mapping"
    if has_image:
        return "image"
    return "generic"


def parse_node_types_from_source(source: str) -> list[str]:
    """bl_idname values a menu draw() would pass to node_operator / add_node_type."""
    seen: list[str] = []
    for match in _NODE_TYPE_CALL.finditer(source):
        ident = match.group(1)
        if ident not in seen:
            seen.append(ident)
    if re.search(r"(?:self\.)?color_mix_node\s*\(", source) and "ShaderNodeMix" not in seen:
        seen.append("ShaderNodeMix")
    return seen


def parse_draw_menu_paths(source: str) -> list[str]:
    return [m.group(1) for m in _DRAW_MENU.finditer(source)]


def parse_menu_contents_ids(source: str) -> list[str]:
    return [m.group(1) for m in _MENU_CONTENTS.finditer(source)]


def parse_tree_type_add_menus(source: str) -> dict[str, str]:
    """Map tree_type → root add-all menu bl_idname, from NODE_MT_add.draw."""
    return {m.group(1): m.group(2) for m in _TREE_TO_ADD_ALL.finditer(source)}


def parse_zone_calls(source: str) -> list[tuple[str, str]]:
    """Zone pairs referenced by a draw() via zone helper names."""
    pairs: list[tuple[str, str]] = []
    for match in _ZONE_CALL.finditer(source):
        pair = ZONE_METHOD_TO_SOURCE_ATTR.get(match.group(1))
        if pair and pair not in pairs:
            pairs.append(pair)
    return pairs


def parse_zone_pairs_from_assignments(source: str) -> list[tuple[str, str]]:
    """Pairs declared as input_node_type / output_node_type in this binary."""
    idents = [m.group(1) for m in _ZONE_ASSIGN.finditer(source)]
    pairs: list[tuple[str, str]] = []
    for i in range(0, len(idents) - 1, 2):
        pair = (idents[i], idents[i + 1])
        if pair not in pairs:
            pairs.append(pair)
    return pairs


def is_pair_property_name(identifier: str) -> bool:
    return identifier in _PAIR_PROPERTY_NAMES


def version_dirname(version_string: str) -> str:
    """Directory name under catalog/versions/. Spaces become underscores."""
    return version_string.strip().replace(" ", "_")


def order_keys(obj: Mapping[str, Any], known: tuple[str, ...]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in known:
        if key in obj:
            out[key] = obj[key]
    for key in obj:
        if key not in known:
            out[key] = obj[key]
    return out


def canonicalize_catalog(catalog: Mapping[str, Any]) -> dict[str, Any]:
    """Stable key order so a second extract differs only in extracted_at."""
    nodes_in = catalog.get("nodes") or {}
    nodes_out = {
        bid: order_keys(
            {
                **node,
                "properties": [order_keys(p, PROPERTY_KEYS) for p in node.get("properties") or []],
                "inputs": [order_keys(s, SOCKET_KEYS) for s in node.get("inputs") or []],
                "outputs": [order_keys(s, SOCKET_KEYS) for s in node.get("outputs") or []],
            },
            NODE_RECORD_KEYS,
        )
        for bid, node in sorted(nodes_in.items(), key=lambda kv: kv[0])
    }
    categories = [
        order_keys(cat, CATEGORY_KEYS) for cat in (catalog.get("categories") or [])
    ]
    skipped = [order_keys(row, SKIPPED_KEYS) for row in (catalog.get("skipped") or [])]
    themes = dict(sorted((catalog.get("themes") or {}).items()))
    socket_colors = dict(sorted((catalog.get("socket_colors") or {}).items()))
    unresolved = sorted(catalog.get("socket_colors_unresolved") or [])
    body = {
        **catalog,
        "themes": themes,
        "socket_colors": socket_colors,
        "socket_colors_unresolved": unresolved,
        "categories": categories,
        "nodes": nodes_out,
        "skipped": skipped,
    }
    return order_keys(body, CATALOG_KEYS)


def catalog_json(catalog: Mapping[str, Any]) -> str:
    """2-space JSON with a trailing newline. Maps keep extractor key order."""
    return json.dumps(canonicalize_catalog(catalog), indent=2, ensure_ascii=False) + "\n"


def without_extracted_at(text: str) -> str:
    """Drop extracted_at so two extracts of the same binary can be compared."""
    data = json.loads(text)
    data.pop("extracted_at", None)
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"
